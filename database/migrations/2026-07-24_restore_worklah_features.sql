USE `c237_024_t3ca2`;

-- Store the student's reusable profile resume
ALTER TABLE `users`
ADD COLUMN `resume_filename` VARCHAR(255) NULL
AFTER `contact`;

-- Store the student's current profile picture
ALTER TABLE `users`
ADD COLUMN `profile_picture_filename` VARCHAR(255) NULL
AFTER `resume_filename`;

-- Keep the student foreign key indexed after removing the unique index
ALTER TABLE `applications`
ADD INDEX `application_student` (`student_id`);

-- Allow a student to reapply after a rejected application
ALTER TABLE `applications`
DROP INDEX `unique_application`;
