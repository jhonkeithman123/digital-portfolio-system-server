-- Adminer 5.4.1 MariaDB 10.4.32-MariaDB dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

CREATE DATABASE `digital_portfolio_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `digital_portfolio_system`;

DROP TABLE IF EXISTS `activities`;
CREATE TABLE `activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `classroom_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `max_score` int(11) DEFAULT 100,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `classroom_id` (`classroom_id`),
  KEY `teacher_id` (`teacher_id`),
  CONSTRAINT `activities_ibfk_1` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activities_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `activity_instructions`;
CREATE TABLE `activity_instructions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `activity_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `instruction_text` varchar(2000) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `teacher_id` (`teacher_id`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `activity_instructions_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_instructions_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `activity_submissions`;
CREATE TABLE `activity_submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `activity_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `graded_at` datetime DEFAULT NULL,
  `graded_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_student` (`student_id`),
  KEY `idx_graded` (`graded_at`),
  KEY `graded_by` (`graded_by`),
  CONSTRAINT `activity_submissions_ibfk_1` FOREIGN KEY (`graded_by`) REFERENCES `users` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_activity` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `classrooms`;
CREATE TABLE `classrooms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `section` varchar(64) DEFAULT NULL,
  `grade` varchar(64) DEFAULT NULL,
  `code` varchar(10) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `school_year` varchar(20) NOT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `link` (`teacher_id`),
  KEY `idx_classrooms_section` (`section`),
  CONSTRAINT `link` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `classrooms` (`id`, `name`, `section`, `grade`, `code`, `teacher_id`, `created_at`, `school_year`, `updated_at`) VALUES
(5,	'Advisory',	'ICT-A2',	'12',	'5JTPsAAKHg',	10,	'2026-01-27 02:33:43',	'2025-2026',	NULL);

DROP TABLE IF EXISTS `classroom_members`;
CREATE TABLE `classroom_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `classroom_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `link3` (`classroom_id`),
  KEY `link4` (`student_id`),
  CONSTRAINT `classroom_members_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `classroom_members_ibfk_2` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `classroom_members` (`id`, `classroom_id`, `student_id`, `joined_at`, `status`, `code`, `name`) VALUES
(7,	5,	9,	'2026-01-27 03:30:51',	'accepted',	'5JTPsAAKHg',	'Advisory');

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `classroom_id` int(11) NOT NULL,
  `activity_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `comment` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `edited` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `activity_id` (`activity_id`),
  KEY `classroom_id` (`classroom_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `comment_replies`;
CREATE TABLE `comment_replies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `comment_id` int(11) NOT NULL,
  `reply` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `edited` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `comment_id` (`comment_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comment_replies_ibfk_1` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comment_replies_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `hidden_invites`;
CREATE TABLE `hidden_invites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `invite_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `invite_id` (`invite_id`),
  CONSTRAINT `hidden_invites_ibfk_1` FOREIGN KEY (`invite_id`) REFERENCES `classroom_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `hidden_invites_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hidden_invites_ibfk_4` FOREIGN KEY (`invite_id`) REFERENCES `classroom_members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `logging`;
CREATE TABLE `logging` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `log` varchar(255) NOT NULL,
  `detected_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FOREIGN KEY` (`user_id`),
  CONSTRAINT `logging_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `recipient_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `type` enum('invite','quiz','system','grade') DEFAULT 'system',
  `message` text NOT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `session`;
CREATE TABLE `session` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` text NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `link-to-user's-table` (`user_id`),
  CONSTRAINT `link-to-user's-table` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `session` (`id`, `user_id`, `token`, `expires_at`) VALUES
(53,	9,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjoiSUNULUEyIiwiaWF0IjoxNzY5NDQ0Mjc3LCJleHAiOjE3Njk1MzA2Nzd9.qip_FGp9MpaecwUvBFLX5AQu07I6z_-nvPl-2sI_yOg',	'2026-01-28 00:17:57'),
(54,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk0NDQyOTQsImV4cCI6MTc2OTUzMDY5NH0.BBMBj-465ID9Cb6FWkHoiq8dtSOq0ySPESk3-MWBGuw',	'2026-01-28 00:18:14'),
(55,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk0NDYwMDAsImV4cCI6MTc2OTUzMjQwMH0.T9Lv4ifPkdeLX7OWMKK3aDqpnNZ2dxkvW8hqjScMBCA',	'2026-01-28 00:46:40'),
(56,	9,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjoiSUNULUEyIiwiaWF0IjoxNzY5NDc0NTg2LCJleHAiOjE3Njk1NjA5ODZ9.kI-Jm7CBqawvk681I_x1zWmdmeBFbx6OtkhyoI9GeHQ',	'2026-01-28 08:43:06'),
(57,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk0NzQ2MDcsImV4cCI6MTc2OTU2MTAwN30.aSJ1har09uAjP8cpxPu1xCwRA8UP1qvcPaYu21TE1_Y',	'2026-01-28 08:43:27'),
(58,	11,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6ImRpZ2l0YWxwb3J0Zm9saW9zeXN0ZW1AZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6ImtlaXRoIiwic2VjdGlvbiI6IklDVC1BMSIsImlhdCI6MTc2OTQ3NzIyOSwiZXhwIjoxNzY5NTYzNjI5fQ.zDNAcd3xQldHyTc8I_ygb6tbhn15nxAlFOF_jbD0rvM',	'2026-01-28 09:27:09'),
(59,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk0ODA5NjcsImV4cCI6MTc2OTU2NzM2N30._Rygr6MBp5EXDWZcATXsFpVS-0XN8B5vlqSgoqrMOmE',	'2026-01-28 10:29:27'),
(60,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk0ODExNTgsImV4cCI6MTc2OTU2NzU1OH0.5hgr29kz72JFxnuMG7dn468hO8HCAOR83Jfj9WpN9YA',	'2026-01-28 10:32:38'),
(61,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk0ODEyMTEsImV4cCI6MTc2OTU2NzYxMX0.QkZD4QxBXsmolwqw4KgZ0QOqPNnCmVcOJiUIsjGe6aY',	'2026-01-28 10:33:31'),
(62,	9,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjoiSUNULUEyIiwiaWF0IjoxNzY5NDgzMTk2LCJleHAiOjE3Njk1Njk1OTZ9.RtRVLaPB0iH3HCHr3Gl8rywrXbVhdpKLRdZ8RtqhDxs',	'2026-01-28 11:06:36'),
(63,	9,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjoiSUNULUEyIiwiaWF0IjoxNzY5NDgzNzQwLCJleHAiOjE3Njk1NzAxNDB9.2Kjatiae3MkEREt-aViKWmbg4aOXtB7M0buIYxroYmw',	'2026-01-28 11:15:40'),
(64,	11,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6ImRpZ2l0YWxwb3J0Zm9saW9zeXN0ZW1AZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6ImtlaXRoIiwic2VjdGlvbiI6IklDVC1BMSIsImlhdCI6MTc2OTQ4NDM4NCwiZXhwIjoxNzY5NTcwNzg0fQ.mDuZpDYie5oLwzz_HqCB3hpqwAAokJkM-FSxQySH3rI',	'2026-01-28 11:26:24'),
(65,	9,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjoiSUNULUEyIiwiaWF0IjoxNzY5NTk0MzI4LCJleHAiOjE3Njk2ODA3Mjh9.NFdlH_1n9cnM1Pl99WqljMb-AnjdLfNPqsP4HG0Co8M',	'2026-01-29 17:58:48'),
(66,	10,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwLCJlbWFpbCI6Imp1c3RpbmVhYmRvbjcxQGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2oiLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njk1OTU4NzYsImV4cCI6MTc2OTY4MjI3Nn0.bx96oENrKRr4qhX81n52ULLxZEeF48ssuWtsq4fXjdc',	'2026-01-29 18:24:36');

DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `classroom_id` int(11) NOT NULL,
  `file_url` text DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `feedback` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `link2` (`student_id`),
  KEY `FOREIGN KEY (classroom)` (`classroom_id`),
  CONSTRAINT `link2` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`),
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `section` varchar(64) DEFAULT NULL,
  `student_number` varchar(255) DEFAULT NULL,
  `grade` varchar(2) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `verification_code` varchar(6) DEFAULT NULL,
  `verification_expiry` datetime DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`ID`),
  KEY `idx_users_section` (`section`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`ID`, `email`, `username`, `section`, `student_number`, `grade`, `password`, `role`, `verification_code`, `verification_expiry`, `is_verified`) VALUES
(9,	'keithvirgenes17@gmail.com',	'Keith',	'ICT-A2',	'AUJS-SHS-AH24-00491',	'12',	'$2b$10$XSf.8p/gVOU62DHTQNBvxOuscyg4E0xxFtWzoQABs.YxDwwEI9awi',	'student',	NULL,	NULL,	1),
(10,	'justineabdon71@gmail.com',	'131fgj',	NULL,	NULL,	NULL,	'$2b$10$cO4VPg7cvbXK3SWLy73KAOvIHy.oIX3BVB4G.VPyO/w6dldXFDO42',	'teacher',	NULL,	NULL,	1),
(11,	'digitalportfoliosystem@gmail.com',	'keith',	'ICT-A1',	'AUJS-SHS-AH-24-00531',	'11',	'$2b$10$xRnPBZxwHpkPRlcmVIX9QOR8uFSkFBMrc8AmGk3J0LXR2HusrATYm',	'student',	NULL,	NULL,	1);

-- 2026-02-06 14:42:01 UTC
