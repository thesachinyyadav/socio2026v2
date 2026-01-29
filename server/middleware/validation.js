import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to check validation results
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Sanitize string input - trim, escape HTML
 */
export const sanitizeString = (field) => 
  body(field)
    .optional()
    .trim()
    .escape();

/**
 * Validate and sanitize email
 */
export const validateEmail = (field = 'email') =>
  body(field)
    .optional()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail();

/**
 * Validate UUID format
 */
export const validateUUID = (field) =>
  param(field)
    .trim()
    .isLength({ min: 1 })
    .withMessage(`${field} is required`);

/**
 * Validate contact form submission
 */
export const validateContactForm = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters')
    .escape(),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters')
    .escape(),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 5000 })
    .withMessage('Message must be less than 5000 characters'),
  validate
];

/**
 * Validate registration form
 */
export const validateRegistration = [
  body('eventId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Event ID must be provided'),
  body('event_id')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Event ID must be provided'),
  body('teammates')
    .optional()
    .isArray()
    .withMessage('Teammates must be an array'),
  body('teammates.*.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid teammate email'),
  body('teammates.*.name')
    .optional()
    .trim()
    .escape(),
  body('teammates.*.registerNumber')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Register number must be alphanumeric'),
  validate
];

/**
 * Validate event creation/update
 */
export const validateEvent = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Description must be less than 10000 characters'),
  body('venue')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Venue must be less than 500 characters')
    .escape(),
  body('organizer_email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid organizer email'),
  body('registration_fee')
    .optional()
    .isNumeric()
    .withMessage('Registration fee must be a number'),
  body('participants_per_team')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Team size must be between 1 and 100'),
  validate
];

/**
 * Validate fest creation/update
 */
export const validateFest = [
  body('festTitle')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Fest title must be between 1 and 200 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Description must be less than 10000 characters'),
  body('contact_email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid contact email'),
  validate
];

/**
 * Sanitize query parameters
 */
export const sanitizeQuery = (fields) => 
  fields.map(field => 
    query(field)
      .optional()
      .trim()
      .escape()
  );
