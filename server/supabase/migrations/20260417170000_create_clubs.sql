-- =============================================================================
-- Migration: Create Clubs + Seed Centres/Cells
-- Date: 2026-04-17
--
-- The `clubs` table is the single source of truth for all clubs, centres,
-- and cells. `type` discriminates between them.
-- Additional columns (slug, subtitle, category) are added here to support
-- existing centre data that predates the clubs feature.
-- =============================================================================

create table clubs (
  club_id              uuid primary key default gen_random_uuid(),
  club_name            text not null,
  club_description     text,
  club_banner_url      text check (club_banner_url like 'https://%' or club_banner_url is null),
  club_registrations   boolean not null default false,
  club_roles_available jsonb not null default '["member", "media", "operations"]'::jsonb,
  club_campus          jsonb not null default '[]'::jsonb,
  club_editors         jsonb not null default '[]'::jsonb,
  club_web_link        text check (club_web_link like 'https://%' or club_web_link is null),

  -- Columns for centres/cells (and optional for clubs)
  slug                 text unique,
  subtitle             text,
  category             text,
  type                 text not null default 'club'
                         check (type in ('club', 'centre', 'cell')),

  created_at           timestamptz not null default now()
);

-- Index for editor email lookups
create index idx_clubs_editors  on clubs using gin (club_editors);
create index idx_clubs_type     on clubs (type);
create index idx_clubs_category on clubs (category);
create index idx_clubs_slug     on clubs (slug);

-- Comments
comment on column clubs.club_registrations   is 'true = registrations open, false = closed';
comment on column clubs.club_roles_available is 'JSON array of available roles e.g. ["member","media","operations"]';
comment on column clubs.club_campus          is 'JSON array of campuses allowed to register e.g. ["Central Campus (Main)","Kengeri Campus"]';
comment on column clubs.club_editors         is 'JSON array of editor emails e.g. ["a@org.com","b@org.com"]';
comment on column clubs.club_web_link        is 'Official club/centre website URL (must be https)';
comment on column clubs.slug                 is 'URL-safe identifier used in /club/[slug] routes';
comment on column clubs.type                 is 'Discriminator: club | centre | cell';

-- =============================================================================
-- Seed: All 31 Centres & Cells
-- =============================================================================

insert into clubs (type, slug, club_name, subtitle, club_description, club_web_link, club_banner_url, category) values

  ('centre', 'sdg-cell', 'SDG Cell', 'Sustainable Development Goal Cell',
   'Committed to integrating UN Sustainable Development Goals into the university''s framework through research, education, and community engagement initiatives.',
   'https://christuniversity.in/center/C/sdg',
   'https://img.recraft.ai/j8wS9gYWtLzTM61OIZ-hh8kHVDv3_hGRBQIvl8YVe1A/rs:fit:2048:1024:0/q:95/g:no/plain/abs://prod/images/f8478bc3-8c33-4344-b64a-27a521778253@jpg',
   'Social'),

  ('centre', 'cnri', 'CNRI', 'Centre for Neurodiversity Research and Innovation',
   'Enhances understanding and support for neurodiverse individuals by fostering research and innovation, creating inclusive environments, and advancing societal awareness and acceptance.',
   'https://christuniversity.in/center/C/cnri',
   'https://christuniversity.in/uploads/centers/thumb/472543836_2024-02-08_04-05-53.jpg',
   'Research'),

  ('centre', 'caps', 'CAPS', 'Centre for Academic and Professional Support',
   'Provides academic and professional training, resources, and talks designed to support students'' academic excellence and career development with workshops on various skills.',
   'https://caps.christuniversity.in/',
   'https://christuniversity.in/uploads/centers/thumb/399194325_2023-07-11_06-36-56.jpg',
   'Academic'),

  ('centre', 'card', 'CARD', 'Centre for Advanced Research and Development',
   'Focuses on advancing research in various disciplines by providing resources, facilities, and support for innovative research projects that contribute to academic knowledge and societal development.',
   'https://christuniversity.in/center/C/card',
   'https://christuniversity.in/uploads/centers/thumb/1464799697_2023-06-16_10-20-28.jpg',
   'Research'),

  ('centre', 'cai', 'CAI', 'Centre for Artificial Intelligence',
   'Dedicated to advancing education, research, and innovation in artificial intelligence, focusing on practical applications of AI technologies in industries and academia.',
   'https://christuniversity.in/center/C/Centre-forArtificialIntelligence',
   'https://christuniversity.in/uploads/centers/thumb/826197872_2023-07-11_06-30-37.jpg',
   'Innovation'),

  ('centre', 'ccrd', 'CCRD', 'Centre for Case Research and Development',
   'Develops comprehensive case studies across disciplines, enhancing teaching effectiveness through real-world business scenarios and facilitating case-based learning and research.',
   'https://christuniversity.in/center/C/Centre-for-Case-Research-and-Development-',
   'https://christuniversity.in/uploads/centers/thumb/1739624898_2023-06-16_09-51-59.jpg',
   'Academic'),

  ('centre', 'ccd', 'CCD', 'Centre for Concept Design',
   'Emphasizes effective communication through media, content, and digital services, nurturing creativity and providing tools to conceptualize and design innovative digital media projects.',
   'https://christuniversity.in/center/C/CCD',
   'https://christuniversity.in/uploads/centers/thumb/1134426620_2023-06-16_09-34-34.jpg',
   'Innovation'),

  ('centre', 'cchs', 'CCHS', 'Centre for Counselling and Health Services',
   'Offers services to support mental and physical well-being of students including counseling sessions, mental health awareness programs, and professional health support.',
   'https://christuniversity.in/center/C/CCHS',
   'https://christuniversity.in/uploads/centers/thumb/474773062_2023-06-16_09-24-32.jpg',
   'Student support'),

  ('centre', 'cdi', 'CDI', 'Centre for Digital Innovation',
   'Fosters digital innovation through cutting-edge technology exploration, encouraging students and faculty to develop innovative digital solutions for real-world challenges.',
   'https://christuniversity.in/center/C/CDI',
   'https://christuniversity.in/uploads/centers/thumb/757176875_2023-06-16_09-14-38.jpg',
   'Innovation'),

  ('centre', 'ceas', 'CEAS', 'Centre for East Asian Studies',
   'Promotes understanding of East Asian cultures, languages, and societies through academic programs, cultural exchanges, and research collaborations with East Asian institutions.',
   'https://ceas.christuniversity.in/',
   'https://christuniversity.in/uploads/centers/thumb/845100346_2023-06-16_09-06-11.jpg',
   'Cultural'),

  ('centre', 'cedbec', 'CEDBEC', 'Centre for Education Beyond Curriculum',
   'Enhances student learning beyond traditional curriculum through workshops, seminars, and experiential learning opportunities that develop critical thinking and practical skills.',
   'https://christuniversity.in/center/C/CEDBEC',
   'https://christuniversity.in/uploads/centers/thumb/1448228427_2023-06-16_08-46-12.jpg',
   'Academic'),

  ('centre', 'cedric', 'CEDRIC', 'Centre for Establishing, Developing, and Research in Incubation Centres',
   'Supports entrepreneurial initiatives by providing resources, mentorship, and infrastructure for startups, fostering innovation and business development within the university ecosystem.',
   'https://christuniversity.in/center/C/cedric',
   'https://christuniversity.in/uploads/centers/thumb/304659937_2023-06-16_06-57-01.jpg',
   'Innovation'),

  ('centre', 'cfpr', 'CFPR', 'Centre for Fiscal Policy Research',
   'Conducts research on fiscal policies and economic trends, providing insights and recommendations for policymakers, academics, and the public on financial and economic issues.',
   'https://christuniversity.in/center/C/cfpr',
   'https://christuniversity.in/uploads/centers/thumb/1042458721_2023-06-16_06-43-44.jpg',
   'Research'),

  ('centre', 'cis', 'CIS', 'Centre for International Studies',
   'Promotes global engagement through international academic collaborations, exchange programs, and research partnerships, enhancing the university''s global presence and perspective.',
   'https://christuniversity.in/center/C/CIS',
   'https://christuniversity.in/uploads/centers/thumb/2130509750_2023-06-16_06-20-01.jpg',
   'Academic'),

  ('centre', 'clgt', 'CLGT', 'Centre for Leadership and Governance Transformation',
   'Develops effective leadership skills and governance practices through training programs, workshops, and research aimed at transforming individuals into responsible leaders.',
   'https://christuniversity.in/center/C/CLGT',
   'https://christuniversity.in/uploads/centers/thumb/1758958172_2023-06-16_05-41-48.jpg',
   'Leadership'),

  ('centre', 'cmtp', 'CMTP', 'Centre for Modern Technologies and Practices',
   'Explores and integrates modern technologies and innovative practices into academic and administrative processes, enhancing efficiency and effectiveness across the university.',
   'https://christuniversity.in/center/C/centre-for-modern-technologies-and-practices-cmtp',
   'https://christuniversity.in/uploads/centers/thumb/798694573_2023-06-16_05-27-37.jpg',
   'Innovation'),

  ('centre', 'cmrp', 'CMRP', 'Centre for Management Research and Projects',
   'Facilitates management research and project-based learning, connecting academic knowledge with real-world management practices and business challenges.',
   'https://christuniversity.in/center/C/cmrp',
   'https://christuniversity.in/uploads/centers/thumb/1555158781_2023-06-16_05-16-57.jpg',
   'Research'),

  ('centre', 'cpe', 'CPE', 'Centre for Professional Excellence',
   'Enhances professional competencies through specialized training programs, industry collaborations, and skill development initiatives that prepare students for successful careers.',
   'https://christuniversity.in/center/C/CPE',
   'https://christuniversity.in/uploads/centers/thumb/2086186414_2023-06-16_05-04-48.jpg',
   'Academic'),

  ('centre', 'cpfa', 'CPFA', 'Centre for Professional Fine Arts',
   'Nurtures artistic talents and creative expression through fine arts programs, exhibitions, and workshops that develop aesthetic sensibilities and professional artistic skills.',
   'https://christuniversity.in/center/C/cpfa',
   'https://christuniversity.in/uploads/centers/thumb/1576222968_2023-06-16_04-45-23.jpg',
   'Cultural'),

  ('centre', 'cpsa', 'CPSA', 'Centre for Professional Skills and Activities',
   'Focuses on developing essential professional skills through practical training, activities, and workshops that enhance employability and workplace readiness.',
   'https://christuniversity.in/center/C/cpsa',
   'https://christuniversity.in/uploads/centers/thumb/1822230593_2023-06-16_04-25-28.jpg',
   'Academic'),

  ('centre', 'crcdc', 'CRCDC', 'Centre for Resource & Curriculum Development for Communication',
   'Develops innovative curriculum and resources for communication studies, enhancing teaching methodologies and learning materials for effective communication education.',
   'https://christuniversity.in/center/C/centre-for-resource-curriculum-development-for-communication-crcdc',
   'https://christuniversity.in/uploads/centers/thumb/1831788784_2023-06-16_04-09-24.jpg',
   'Academic'),

  ('centre', 'crsl', 'CRSL', 'Centre for Research in Social Innovation and Leadership',
   'Promotes research and initiatives focused on social innovation and leadership development, addressing societal challenges through innovative leadership approaches.',
   'https://christuniversity.in/center/C/crsl',
   'https://christuniversity.in/uploads/centers/thumb/806621914_2023-06-16_03-51-33.jpg',
   'Social'),

  ('centre', 'csa', 'CSA', 'Centre for Social Action',
   'Engages in community service and social responsibility initiatives, encouraging students to contribute to society through various outreach programs and volunteer activities.',
   'https://christuniversity.in/center/C/CSA',
   'https://christuniversity.in/uploads/centers/thumb/91103435_2023-06-16_03-32-05.jpg',
   'Social'),

  ('centre', 'csed', 'CSED', 'Centre for Software Engineering and Development',
   'Focuses on software engineering principles and practices, developing innovative software solutions and providing expertise in software development methodologies.',
   'https://christuniversity.in/center/C/csed',
   'https://christuniversity.in/uploads/centers/thumb/1193308951_2023-06-16_03-15-35.jpg',
   'Innovation'),

  ('centre', 'ctit', 'CTIT', 'Centre for Technology in Teaching and Testing',
   'Integrates technology into teaching and assessment processes, enhancing educational delivery through innovative technological tools and digital assessment methods.',
   'https://ctit.christuniversity.in/',
   'https://christuniversity.in/uploads/centers/thumb/685376776_2023-06-16_02-48-47.jpg',
   'Academic'),

  ('centre', 'ctil', 'CTIL', 'Centre for Technology Innovation Lab',
   'Provides a platform for technological innovation and experimentation, encouraging students to develop new technologies and solutions for various applications.',
   'https://christuniversity.in/center/C/CTIL',
   'https://christuniversity.in/uploads/centers/thumb/696573225_2023-06-16_02-26-04.jpg',
   'Innovation'),

  ('centre', 'ctms', 'CTMS', 'Centre for Test Management and Standardization',
   'Ensures quality and standardization in testing and assessment methodologies, developing reliable evaluation systems for measuring student learning outcomes.',
   'https://christuniversity.in/center/C/CTMS',
   'https://christuniversity.in/uploads/centers/thumb/589231854_2023-06-16_02-07-49.jpg',
   'Academic'),

  ('centre', 'cwe', 'CWE', 'Centre for Wellness Education',
   'Promotes holistic well-being through wellness education programs, activities, and initiatives that address physical, mental, and emotional health of the university community.',
   'https://christuniversity.in/center/C/CWE',
   'https://christuniversity.in/uploads/centers/thumb/1987413024_2023-06-14_09-59-16.jpg',
   'Student support'),

  ('centre', 'cwsr', 'CWSR', 'Centre for Women''s Studies and Research',
   'Focuses on gender studies, women''s empowerment, and research addressing gender-related issues, promoting equality and understanding through academic programs and advocacy.',
   'https://christuniversity.in/center/C/cwsr',
   'https://christuniversity.in/uploads/centers/thumb/1393908217_2023-06-14_09-42-15.jpg',
   'Research'),

  ('centre', 'ichr', 'ICHR', 'ICHR Chair on Gandhi Studies',
   'Promotes research and academic programs on Gandhian philosophy, principles, and their application in contemporary society through dedicated study and scholarship.',
   'https://christuniversity.in/center/C/ICHR',
   'https://christuniversity.in/uploads/centers/thumb/1227115096_2023-06-14_09-25-26.jpg',
   'Research'),

  ('centre', 'sports', 'Sports and Games', 'Centre for Sports Excellence',
   'Provides world-class sporting facilities, coaching, and competitive opportunities for students to excel in various sports and games at national and international levels.',
   'https://christuniversity.in/center/C/sports',
   'https://christuniversity.in/uploads/centers/thumb/1539989876_2023-06-14_08-55-42.jpg',
   'Sports')

on conflict (slug) do update
  set club_name       = excluded.club_name,
      subtitle        = excluded.subtitle,
      club_description = excluded.club_description,
      club_web_link   = excluded.club_web_link,
      club_banner_url = excluded.club_banner_url,
      category        = excluded.category;
