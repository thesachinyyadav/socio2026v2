/**
 * gatedSync.js — SOCIO ↔ UniversityGated Integration Utility
 * 
 * Handles:
 * 1. Ensuring/creating organiser accounts in Gated's users table
 * 2. Pushing events & fests to Gated's event_requests table
 * 3. Creating Gated visitor passes from SOCIO outsider registrations
 * 4. Resolving Gated event IDs from SOCIO event IDs
 */

import crypto from 'crypto';
import {
  isGatedEnabled,
  gatedQueryOne,
  gatedQueryAll,
  gatedInsert,
  gatedUpdate,
} from '../config/gatedDatabase.js';

// Re-export isGatedEnabled so route files can import it from here
export { isGatedEnabled };

const GATED_APP_URL = process.env.GATED_APP_URL || 'https://universitygated.vercel.app';

// ─── Organiser Management ──────────────────────────────────────────────────────

/**
 * Ensure a Gated organiser account exists for the SOCIO user.
 * Creates one if missing. Returns the Gated users.id UUID.
 *
 * @param {string} email - Organiser's email (used as username in Gated)
 * @param {string} fullName - Organiser's display name
 * @param {string} department - Organiser's department
 * @returns {Promise<string>} Gated user UUID
 */
export async function ensureGatedOrganiser(email, fullName, department) {
  if (!isGatedEnabled()) {
    throw new Error('Gated integration not configured');
  }

  // Check if user already exists in Gated by username (email)
  const existing = await gatedQueryOne('users', {
    where: { username: email },
  });

  if (existing) {
    return existing.id;
  }

  // Create a new organiser in Gated
  // Generate a random password — Gated auth is independent, this account
  // is only used as an FK target for event_requests.organiser_id
  const randomPassword = crypto.randomBytes(32).toString('hex');

  const [created] = await gatedInsert('users', [{
    username: email,
    password: randomPassword,
    role: 'organiser',
    full_name: fullName || email.split('@')[0],
    department: department || 'SOCIO Platform',
  }]);

  console.log(`✅ Created Gated organiser account for ${email}: ${created.id}`);
  return created.id;
}

// ─── Event Push ─────────────────────────────────────────────────────────────────

/**
 * Push a SOCIO event to Gated's event_requests table.
 * Deduplicates via socio_event_id. Updates if already exists.
 *
 * @param {Object} socioEvent - The SOCIO event object
 * @param {string} socioEvent.event_id - SOCIO event ID
 * @param {string} socioEvent.title - Event title
 * @param {string} socioEvent.description - Event description
 * @param {string} socioEvent.event_date - Start date (YYYY-MM-DD)
 * @param {string} socioEvent.end_date - End date (YYYY-MM-DD)
 * @param {string} socioEvent.organizing_dept - Department
 * @param {number} socioEvent.outsider_max_participants - Max outsider capacity
 * @param {number} socioEvent.total_participants - Total expected participants
 * @param {string} organiserEmail - Organiser's email
 * @param {string} organiserName - Organiser's name
 * @returns {Promise<Object>} The created/updated event_request row
 */
export async function pushEventToGated(socioEvent, organiserEmail, organiserName) {
  if (!isGatedEnabled()) {
    console.warn('⚠️  Gated integration not configured — skipping event push');
    return null;
  }

  try {
    // Ensure the organiser exists in Gated
    const gatedOrganiserId = await ensureGatedOrganiser(
      organiserEmail,
      organiserName,
      socioEvent.organizing_dept || 'Unknown'
    );

    // Check if already pushed (deduplication)
    const existing = await gatedQueryOne('event_requests', {
      where: { socio_event_id: socioEvent.event_id },
    });

    const maxCapacity = socioEvent.outsider_max_participants || socioEvent.total_participants || 100;
    const expectedStudents = Math.min(socioEvent.outsider_max_participants || maxCapacity, maxCapacity);

    const requestData = {
      organiser_id: gatedOrganiserId,
      department: socioEvent.organizing_dept || 'General',
      event_name: socioEvent.title,
      event_description: socioEvent.description || null,
      date_from: socioEvent.event_date,
      date_to: socioEvent.end_date || socioEvent.event_date,
      expected_students: expectedStudents,
      max_capacity: maxCapacity,
      socio_event_id: socioEvent.event_id,
      source: 'socio',
    };

    if (existing) {
      // Update existing request
      const updated = await gatedUpdate('event_requests', {
        ...requestData,
        updated_at: new Date().toISOString(),
      }, { id: existing.id });

      console.log(`🔄 Updated Gated event_request for SOCIO event "${socioEvent.title}" (${existing.id})`);
      return updated?.[0] || existing;
    } else {
      // Insert new request
      requestData.status = 'pending';
      const [created] = await gatedInsert('event_requests', [requestData]);

      console.log(`📤 Pushed SOCIO event "${socioEvent.title}" to Gated event_requests (${created.id})`);
      return created;
    }
  } catch (error) {
    console.error(`❌ Failed to push event "${socioEvent.title}" to Gated:`, error.message);
    throw error;
  }
}

// ─── Fest Push ──────────────────────────────────────────────────────────────────

/**
 * Push a SOCIO fest to Gated's event_requests table.
 * Fests are pushed as a single event request that covers all child events.
 *
 * @param {Object} socioFest - The SOCIO fest object
 * @param {string} socioFest.fest_id - SOCIO fest ID (slug)
 * @param {string} socioFest.fest_title - Fest title
 * @param {string} socioFest.description - Fest description
 * @param {string} socioFest.opening_date - Start date
 * @param {string} socioFest.closing_date - End date
 * @param {string} socioFest.organizing_dept - Department
 * @param {string} organiserEmail - Organiser's email
 * @param {string} organiserName - Organiser's name
 * @returns {Promise<Object>} The created/updated event_request row
 */
export async function pushFestToGated(socioFest, organiserEmail, organiserName) {
  if (!isGatedEnabled()) {
    console.warn('⚠️  Gated integration not configured — skipping fest push');
    return null;
  }

  try {
    const gatedOrganiserId = await ensureGatedOrganiser(
      organiserEmail,
      organiserName,
      socioFest.organizing_dept || 'Unknown'
    );

    // Check deduplication
    const existing = await gatedQueryOne('event_requests', {
      where: { socio_event_id: socioFest.fest_id },
    });

    const requestData = {
      organiser_id: gatedOrganiserId,
      department: socioFest.organizing_dept || 'General',
      event_name: `[FEST] ${socioFest.fest_title}`,
      event_description: socioFest.description || null,
      date_from: socioFest.opening_date,
      date_to: socioFest.closing_date,
      expected_students: 500, // Default estimate for fests
      max_capacity: 1000, // Default capacity for fests
      socio_event_id: socioFest.fest_id,
      source: 'socio',
    };

    if (existing) {
      const updated = await gatedUpdate('event_requests', {
        ...requestData,
        updated_at: new Date().toISOString(),
      }, { id: existing.id });

      console.log(`🔄 Updated Gated event_request for SOCIO fest "${socioFest.fest_title}" (${existing.id})`);
      return updated?.[0] || existing;
    } else {
      requestData.status = 'pending';
      const [created] = await gatedInsert('event_requests', [requestData]);

      console.log(`📤 Pushed SOCIO fest "${socioFest.fest_title}" to Gated event_requests (${created.id})`);
      return created;
    }
  } catch (error) {
    console.error(`❌ Failed to push fest "${socioFest.fest_title}" to Gated:`, error.message);
    throw error;
  }
}

// ─── Gated Event Resolution ────────────────────────────────────────────────────

/**
 * Resolve the Gated events.id for a SOCIO event.
 * The flow: SOCIO event_id → Gated event_requests (by socio_event_id) → Gated events (by event_request_id).
 * Returns null if the CSO hasn't approved the request yet.
 *
 * @param {string} socioEventId - The SOCIO event_id or fest_id
 * @returns {Promise<Object|null>} The Gated event row, or null if not yet approved
 */
export async function resolveGatedEvent(socioEventId) {
  if (!isGatedEnabled()) return null;

  try {
    // Find the Gated event_request by socio_event_id
    const request = await gatedQueryOne('event_requests', {
      where: { socio_event_id: socioEventId },
    });

    if (!request) {
      console.log(`ℹ️  No Gated event_request found for SOCIO ID: ${socioEventId}`);
      return null;
    }

    if (request.status !== 'approved') {
      console.log(`ℹ️  Gated event_request for "${socioEventId}" is ${request.status} — not yet approved`);
      return null;
    }

    // Find the corresponding Gated event (created by trigger on approval)
    const gatedEvent = await gatedQueryOne('events', {
      where: { event_request_id: request.id },
    });

    if (!gatedEvent) {
      console.warn(`⚠️  Gated event_request ${request.id} is approved but no events row found`);
      return null;
    }

    return gatedEvent;
  } catch (error) {
    console.error(`❌ Failed to resolve Gated event for SOCIO ID "${socioEventId}":`, error.message);
    return null;
  }
}

// ─── Visitor Creation ───────────────────────────────────────────────────────────

/**
 * Create a Gated visitor pass for an outsider who registered in SOCIO.
 * Returns the Gated visitors.id UUID (used for gate-entry QR).
 *
 * @param {Object} params
 * @param {string} params.name - Visitor name
 * @param {string} params.email - Visitor email
 * @param {string} params.phone - Visitor phone
 * @param {string} params.registerNumber - Visitor register number (VIS...)
 * @param {string} params.eventName - Event name
 * @param {string} params.dateFrom - Visit start date
 * @param {string} params.dateTo - Visit end date
 * @param {string} params.gatedEventId - The Gated events.id UUID
 * @returns {Promise<Object|null>} The created visitor row with id for QR generation
 */
export async function createGatedVisitor({
  name,
  email,
  phone,
  registerNumber,
  eventName,
  dateFrom,
  dateTo,
  gatedEventId,
}) {
  if (!isGatedEnabled()) {
    console.warn('⚠️  Gated integration not configured — skipping visitor creation');
    return null;
  }

  try {
    const [visitor] = await gatedInsert('visitors', [{
      name,
      email: email || null,
      phone: phone || null,
      register_number: registerNumber || null,
      event_id: gatedEventId,
      event_name: eventName,
      date_of_visit_from: dateFrom,
      date_of_visit_to: dateTo,
      visitor_category: 'student', // Outsiders registered via SOCIO → student category
      purpose: 'Event Registration via SOCIO',
      status: 'approved', // Auto-approved since event is already approved in Gated
    }]);

    console.log(`🎫 Created Gated visitor pass for ${name} (${visitor.id})`);
    return visitor;
  } catch (error) {
    console.error(`❌ Failed to create Gated visitor for ${name}:`, error.message);
    throw error;
  }
}

/**
 * Generate a Gated verify URL for a visitor (used as QR content).
 *
 * @param {string} gatedVisitorId - The Gated visitors.id UUID
 * @returns {string} The full verify URL
 */
export function getGatedVerifyUrl(gatedVisitorId) {
  return `${GATED_APP_URL}/verify?id=${gatedVisitorId}`;
}

/**
 * Check if a SOCIO event requires Gated integration (is outsider-enabled
 * and is either standalone or under a non-outsider fest).
 * 
 * Events under fests with allow_outsiders=true should NOT push individually — 
 * the fest covers them.
 *
 * @param {Object} event - The SOCIO event object
 * @param {Function} queryOneFn - The SOCIO queryOne function (to check fest)
 * @returns {Promise<boolean>} Whether this event should push to Gated
 */
export async function shouldPushEventToGated(event, queryOneFn) {
  // Must have outsiders enabled
  const allowsOutsiders = !!(
    event.allow_outsiders === true ||
    event.allow_outsiders === 'true' ||
    event.allow_outsiders === 1 ||
    event.allow_outsiders === '1'
  );

  if (!allowsOutsiders) return false;

  // If event belongs to a fest, check if the fest already handles outsiders
  if (event.fest) {
    try {
      const fest = await queryOneFn('fest', { where: { fest_id: event.fest } });
      if (fest && (fest.allow_outsiders === true || fest.allow_outsiders === 'true')) {
        // Fest already covers outsiders — skip individual push
        console.log(`ℹ️  Event "${event.title}" is under fest "${event.fest}" which already handles outsiders — skipping individual push`);
        return false;
      }
    } catch (e) {
      console.warn(`⚠️  Could not check fest for event "${event.title}":`, e.message);
    }
  }

  return true;
}

export default {
  ensureGatedOrganiser,
  pushEventToGated,
  pushFestToGated,
  resolveGatedEvent,
  createGatedVisitor,
  getGatedVerifyUrl,
  shouldPushEventToGated,
  isGatedEnabled,
};
