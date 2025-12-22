-- Adminer 5.4.1 MariaDB 11.8.3-MariaDB-0+deb13u1 from Debian dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

CREATE DATABASE `digital_portfolio_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;
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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `classroom_id` (`classroom_id`),
  KEY `teacher_id` (`teacher_id`),
  CONSTRAINT `activities_ibfk_1` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activities_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `activities` (`id`, `classroom_id`, `teacher_id`, `title`, `file_path`, `original_name`, `mime_type`, `created_at`) VALUES
(1,	5,	4,	'Sample Activity',	NULL,	NULL,	NULL,	'2025-11-16 08:04:55');

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `classrooms`;
CREATE TABLE `classrooms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `section` varchar(64) DEFAULT NULL,
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

INSERT INTO `classrooms` (`id`, `name`, `section`, `code`, `teacher_id`, `created_at`, `school_year`, `updated_at`) VALUES
(5,	'Advisory',	'DIT 1-5',	'mUq0oFzlui',	4,	'2025-11-15 14:26:04',	'2025-2026',	'0000-00-00 00:00:00');

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
  CONSTRAINT `link3` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`),
  CONSTRAINT `link4` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `classroom_members` (`id`, `classroom_id`, `student_id`, `joined_at`, `status`, `code`, `name`) VALUES
(5,	5,	3,	'2025-10-24 14:12:29',	'accepted',	'mUq0oFzlui',	'Advisory');

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
  CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `comments` (`id`, `classroom_id`, `activity_id`, `user_id`, `comment`, `created_at`, `updated_at`, `edited`) VALUES
(10,	5,	1,	3,	'Hello',	'2025-11-25 19:15:03',	'2025-12-21 23:21:22',	1),
(11,	5,	1,	3,	'hi',	'2025-11-25 19:42:45',	'2025-11-25 19:42:45',	0),
(12,	5,	1,	3,	'Hi',	'2025-11-25 19:54:31',	'2025-11-25 19:54:31',	0),
(13,	5,	1,	3,	'Hi',	'2025-11-25 20:14:31',	'2025-11-25 20:14:31',	0),
(14,	5,	1,	3,	'Lol',	'2025-11-25 22:20:36',	'2025-11-25 22:20:36',	0);

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
  CONSTRAINT `comment_replies_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `comment_replies` (`id`, `user_id`, `comment_id`, `reply`, `created_at`, `updated_at`, `edited`) VALUES
(1,	3,	10,	'Hello',	'2025-11-25 22:00:34',	'2025-12-21 23:29:01',	1),
(2,	3,	10,	'lal',	'2025-11-25 22:00:54',	'2025-12-21 23:29:10',	1),
(3,	3,	14,	'lol',	'2025-11-25 22:20:44',	'2025-11-25 22:20:44',	0),
(4,	3,	10,	'hi',	'2025-11-28 13:01:43',	'2025-11-28 13:01:43',	0),
(5,	4,	14,	'Hehe',	'2025-12-21 23:29:46',	'2025-12-21 23:29:46',	0),
(6,	4,	14,	'Heheee',	'2025-12-21 23:34:38',	'2025-12-21 23:34:44',	1);

DROP TABLE IF EXISTS `hidden_invites`;
CREATE TABLE `hidden_invites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `invite_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `invite_id` (`invite_id`),
  CONSTRAINT `hidden_invites_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`),
  CONSTRAINT `hidden_invites_ibfk_2` FOREIGN KEY (`invite_id`) REFERENCES `classroom_members` (`id`)
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
  CONSTRAINT `FOREIGN KEY` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `recipient_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `type` enum('invite','quiz','feedback','system') DEFAULT 'system',
  `message` text NOT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `notifications` (`id`, `recipient_id`, `sender_id`, `type`, `message`, `link`, `is_read`, `created_at`) VALUES
(1,	3,	4,	'invite',	'You\'ve been invited to join classroom mUq0oFzlui',	'/classrooms/mUq0oFzlui',	1,	'2025-10-22 14:17:31'),
(2,	3,	4,	'invite',	'You\'ve been invited to join classroom mUq0oFzlui',	'/classrooms/mUq0oFzlui',	1,	'2025-10-22 14:18:36'),
(3,	3,	4,	'invite',	'You\'ve been invited to join classroom mUq0oFzlui',	'/classrooms/mUq0oFzlui',	1,	'2025-10-24 22:12:29');

DROP TABLE IF EXISTS `quizzes`;
CREATE TABLE `quizzes` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `classroom_id` int(11) NOT NULL,
  `teacher_id` int(10) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `questions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`questions`)),
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `attempts_allowed` int(10) unsigned DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `time_limit_seconds` int(11) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_quizzes_classroom` (`classroom_id`),
  CONSTRAINT `fk_quizzes_classroom` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `quizzes` (`id`, `classroom_id`, `teacher_id`, `title`, `questions`, `attempts`, `attempts_allowed`, `start_time`, `end_time`, `time_limit_seconds`, `created_at`, `updated_at`) VALUES
(10,	5,	4,	'Sample Quiz',	'{\"pages\":[{\"id\":\"page-nr7b0wu\",\"title\":\"Sample Question 1\",\"questions\":[{\"id\":\"q-6qluvqh\",\"type\":\"multiple_choice\",\"text\":\"This is a sample question\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":\"2\"}]},{\"id\":\"page-n82yeti\",\"title\":\"Sample Question 2\",\"questions\":[{\"id\":\"q-av8ehts\",\"type\":\"short_answer\",\"text\":\"This is a sample question\",\"sentenceLimit\":3,\"correctAnswer\":\"\"}]},{\"id\":\"page-zwwfkoo\",\"title\":\"Sample Question 3\",\"questions\":[{\"id\":\"q-jplbmr8\",\"type\":\"paragraph\",\"text\":\"This is a sample question\",\"sentenceLimit\":5,\"correctAnswer\":\"\"}]},{\"id\":\"page-qks1hhs\",\"title\":\"Sample Question 4\",\"questions\":[{\"id\":\"q-d71ndc7\",\"type\":\"checkboxes\",\"text\":\"This is a sample question\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[]}]}]}',	0,	2,	NULL,	NULL,	3600,	'2025-11-24 02:41:58',	'0000-00-00 00:00:00');

DROP TABLE IF EXISTS `quiz_attempts`;
CREATE TABLE `quiz_attempts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `quiz_id` int(10) unsigned NOT NULL,
  `student_id` int(10) unsigned NOT NULL,
  `attempt_no` int(10) unsigned NOT NULL,
  `answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`answers`)),
  `score` int(11) DEFAULT NULL,
  `grading` varchar(255) DEFAULT NULL,
  `comment` varchar(255) DEFAULT NULL,
  `graded_at` timestamp NULL DEFAULT NULL,
  `grader_id` int(11) DEFAULT NULL,
  `status` enum('in_progress','completed','expired') NOT NULL DEFAULT 'in_progress',
  `started_at` datetime NOT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quiz_student_attempt` (`quiz_id`,`student_id`,`attempt_no`),
  KEY `quiz_id` (`quiz_id`),
  KEY `student_id` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `quiz_attempts` (`id`, `quiz_id`, `student_id`, `attempt_no`, `answers`, `score`, `grading`, `comment`, `graded_at`, `grader_id`, `status`, `started_at`, `submitted_at`, `expires_at`) VALUES
(7,	10,	4,	1,	'{\"q-6qluvqh\":\"0\",\"q-av8ehts\":\"this is a sample answer\"}',	25,	NULL,	NULL,	NULL,	NULL,	'completed',	'2025-11-24 11:05:40',	'2025-11-24 11:12:47',	'2025-11-24 12:05:40'),
(8,	10,	4,	2,	'{\"q-6qluvqh\":\"0\",\"q-av8ehts\":\"this is a sample answer\\n\",\"q-jplbmr8\":\"lol answer\",\"q-d71ndc7\":[\"0\",\"1\",\"2\",\"3\"]}',	0,	NULL,	NULL,	NULL,	NULL,	'completed',	'2025-11-24 11:24:06',	'2025-11-24 11:25:04',	'2025-11-24 12:24:06'),
(9,	10,	3,	1,	'{\"q-6qluvqh\":\"2\",\"q-av8ehts\":\"ahhhhhhhhhhhhhhhhhhhhhhhhhhh\",\"q-jplbmr8\":\"lol\",\"q-d71ndc7\":[0,1,2,3]}',	25,	NULL,	NULL,	NULL,	NULL,	'completed',	'2025-11-25 19:03:16',	'2025-11-25 19:03:42',	'2025-11-25 20:03:16');

DROP TABLE IF EXISTS `quiz_pages`;
CREATE TABLE `quiz_pages` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) unsigned NOT NULL,
  `page_index` int(11) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `content_json` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_qp_quiz` (`quiz_id`,`page_index`),
  CONSTRAINT `fk_qp_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `quiz_pages` (`id`, `quiz_id`, `page_index`, `title`, `content_json`, `created_at`) VALUES
(32,	10,	0,	'Sample Question 1',	'{\"questions\":[{\"id\":\"q-6qluvqh\",\"type\":\"multiple_choice\",\"text\":\"This is a sample question\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":\"2\"}]}',	'2025-11-24 02:41:58'),
(33,	10,	1,	'Sample Question 2',	'{\"questions\":[{\"id\":\"q-av8ehts\",\"type\":\"short_answer\",\"text\":\"This is a sample question\",\"sentenceLimit\":3,\"correctAnswer\":\"\"}]}',	'2025-11-24 02:41:58'),
(34,	10,	2,	'Sample Question 3',	'{\"questions\":[{\"id\":\"q-jplbmr8\",\"type\":\"paragraph\",\"text\":\"This is a sample question\",\"sentenceLimit\":5,\"correctAnswer\":\"\"}]}',	'2025-11-24 02:41:58'),
(35,	10,	3,	'Sample Question 4',	'{\"questions\":[{\"id\":\"q-d71ndc7\",\"type\":\"checkboxes\",\"text\":\"This is a sample question\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[]}]}',	'2025-11-24 02:41:58');

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
(1,	4,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjUyODkwMjQsImV4cCI6MTc2NTI5NjIyNH0.DlVTBZZEqzWbU81HcIUnwzYxG46cHRv6IEtyMCwaf1s',	'2025-12-10 00:03:44'),
(2,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjUwODEsImV4cCI6MTc2NjMzMjI4MX0.zJRlIBSEJXoxXrp-7Qdm0n1K1jqeE8s-xbd8-1iCiIo',	'2025-12-21 23:51:21'),
(3,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjUwOTQsImV4cCI6MTc2NjMzMjI5NH0.mUVA_vrqeAYxt0rJ_tzfxiTTNP_3-Z-19Omo-dAM4i4',	'2025-12-21 23:51:34'),
(4,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjUxNjIsImV4cCI6MTc2NjMzMjM2Mn0.f4uE7mz9JrBcj3z5qEDJTc_DccJuC6o0XYckBxdU4g4',	'2025-12-21 23:52:42'),
(5,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjU1NjksImV4cCI6MTc2NjQxMTk2OX0.NWLMIHiAX5qQJoyOJyvf_FLts9OlMuM3ld6K1vzgZ9g',	'2025-12-22 21:59:29'),
(6,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjY3MjAsImV4cCI6MTc2NjQxMzEyMH0.VQx9tbCzLHYCt30NAudplXquzahVHBZZ3xJ1vmGXmV4',	'2025-12-22 22:18:40'),
(7,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjY3OTAsImV4cCI6MTc2NjQxMzE5MH0.tbIGYOl8SPg1RSLofTfhVXZ-EVZtPv7IUMUkQrmAHG0',	'2025-12-22 22:19:50'),
(8,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjY4MzIsImV4cCI6MTc2NjQxMzIzMn0.F1GKZjEs-BRF20jnIXhUJxKkK_P6r6ja-nWWmKZhsTI',	'2025-12-22 22:20:32'),
(9,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjY4OTIsImV4cCI6MTc2NjQxMzI5Mn0.3sXycS8zOokzClFu9qgPAXJaCcMaiVI56VR-2OfT3KA',	'2025-12-22 22:21:32'),
(10,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjcwMTEsImV4cCI6MTc2NjQxMzQxMX0.EwYeEHWGiBuIE2miVSU4t8CwyyhLMLZwVWfphK7YZQU',	'2025-12-22 22:23:31'),
(11,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjcwMjMsImV4cCI6MTc2NjQxMzQyM30.LFE_eikHNoqRogk7nG3tvBammvZs8NU4AByROD3ymjU',	'2025-12-22 22:23:43'),
(12,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjc0MTEsImV4cCI6MTc2NjQxMzgxMX0.MMmEtiVZMCASCFKLBlSzzvdesYMgFsRd8cxT34l5-Ig',	'2025-12-22 22:30:11'),
(13,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjc3ODEsImV4cCI6MTc2NjQxNDE4MX0.MBt9tZYC6LY_sNbHGMz23RXNhgj6Otz7lFSzI-mVrz0',	'2025-12-22 22:36:21'),
(14,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjgwNjMsImV4cCI6MTc2NjQxNDQ2M30.FLtjayjMMaSzHXmom9HECrtJAOCttXGL4qHMnqDYGLM',	'2025-12-22 22:41:03'),
(15,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjgyMzIsImV4cCI6MTc2NjQxNDYzMn0.aVYZyFvPkVO-raO_cxSLgF3BTZqfBEbGsMKCd3dPxVg',	'2025-12-22 22:43:52'),
(16,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjgzNzQsImV4cCI6MTc2NjQxNDc3NH0.hQ7HiNQP1FwuF0gx9ckgisja9kixMLDFLYrYY0mfsrM',	'2025-12-22 22:46:14'),
(17,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjg2MzAsImV4cCI6MTc2NjQxNTAzMH0.L0AYC6X1K2G0I0kSoESsR0ylmCCW_t0uxXoho2INTrU',	'2025-12-22 22:50:30'),
(18,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjg2ODQsImV4cCI6MTc2NjQxNTA4NH0.EIn8cTtLc80WyV-KIS2fzGs9ooiR7fkbFZiuaSNk39U',	'2025-12-22 22:51:24'),
(19,	3,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwidXNlcm5hbWUiOiJLZWl0aCBKdXN0aW5lIEEuIFZpcmdlbmVzIiwic2VjdGlvbiI6IkRJVCAxLTUiLCJpYXQiOjE3NjYzMjg3NjIsImV4cCI6MTc2NjQxNTE2Mn0.isqEhYQi_n-py4TSp8p6AS7l-CHFbu1emCaJFdkNPLM',	'2025-12-22 22:52:42'),
(20,	4,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InRlYWNoZXIiLCJ1c2VybmFtZSI6IjEzMWZnaCIsInNlY3Rpb24iOm51bGwsImlhdCI6MTc2NjMzMDk2OSwiZXhwIjoxNzY2NDE3MzY5fQ.fhb1jthA0PtOKlY3eRSsIHfEHlW_DgGdiqzC53qJqAM',	'2025-12-22 23:29:29');

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
  CONSTRAINT `FOREIGN KEY (classroom)` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`),
  CONSTRAINT `link2` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `section` varchar(64) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `verification_code` varchar(6) DEFAULT NULL,
  `verification_expiry` datetime DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`ID`),
  KEY `idx_users_section` (`section`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`ID`, `email`, `username`, `section`, `password`, `role`, `verification_code`, `verification_expiry`, `is_verified`) VALUES
(3,	'keithvirgenes17@gmail.com',	'Keith Justine A. Virgenes',	'DIT 1-5',	'$2b$10$CToIc872O0BODciIYqrS1uSDIU0pG8/doQ0SXcBOvzPKKaOOMeyx.',	'student',	NULL,	NULL,	0),
(4,	'justineabdon71@gmail.com',	'131fgh',	NULL,	'$2b$10$POctQm8T.wciahfiegozPuO88tQ/B.CLxmK3l2dSwX99dr1zIPjYa',	'teacher',	NULL,	NULL,	0);

-- 2025-12-22 07:03:06 UTC
