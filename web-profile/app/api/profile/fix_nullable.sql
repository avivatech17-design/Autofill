-- Make experience/education nullable and defaults safe
alter table autofill_experiences
  alter column id set default uuid_generate_v4(),
  alter column created_at set default now(),
  alter column company_name drop not null,
  alter column job_title drop not null,
  alter column location drop not null,
  alter column start_month drop not null,
  alter column start_year drop not null,
  alter column end_month drop not null,
  alter column end_year drop not null,
  alter column is_current drop not null,
  alter column description drop not null;

alter table autofill_educations
  alter column id set default uuid_generate_v4(),
  alter column created_at set default now(),
  alter column school_name drop not null,
  alter column major drop not null,
  alter column degree_type drop not null,
  alter column gpa drop not null,
  alter column start_month drop not null,
  alter column start_year drop not null,
  alter column end_month drop not null,
  alter column end_year drop not null,
  alter column description drop not null;
