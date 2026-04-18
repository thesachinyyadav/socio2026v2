-- Migration: 005_link_users_to_departments.sql
-- Purpose: Add department link to users table
-- Date: 2026-04-02
--
-- This adds the ability for users to be linked to their department,
-- which includes all their course information in JSON format.

-- Add department_id foreign key to users table
alter table if exists public.users
add column if not exists department_id uuid;

-- Add foreign key constraint to link users to departments_courses
alter table if exists public.users
add constraint if not exists fk_users_department
  foreign key (department_id)
  references public.departments_courses(id)
  on update cascade
  on delete set null;

-- Create index for department lookups
create index if not exists idx_users_department_id on public.users(department_id);

-- Document: Once a user sets their department, they get access to:
-- 1. All courses in that department (from courses_json)
-- 2. Class details (room, block, term)
-- 3. School information
-- 
-- Example query to get a user's courses:
-- SELECT dc.department_name, dc.courses_json 
-- FROM users u
-- JOIN departments_courses dc ON u.department_id = dc.id
-- WHERE u.id = '[user_id]';

