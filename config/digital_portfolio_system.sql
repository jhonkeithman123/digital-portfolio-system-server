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

INSERT INTO `activities` (`id`, `classroom_id`, `teacher_id`, `title`, `file_path`, `original_name`, `mime_type`, `max_score`, `created_at`) VALUES
(1,	1,	1,	'Sample Activity',	NULL,	NULL,	NULL,	100,	'2026-01-05 06:54:50'),
(2,	2,	5,	'Sample Activity',	'1769060700665__Flowcharts.pdf',	'Flowcharts.pdf',	'application/pdf',	100,	'2026-01-22 05:45:00');

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

INSERT INTO `activity_instructions` (`id`, `activity_id`, `teacher_id`, `instruction_text`, `created_at`, `updated_at`) VALUES
(1,	1,	1,	'This is a sample instruction, pass anything',	'2026-01-05 06:54:50',	'2026-01-05 06:54:50'),
(2,	2,	5,	'This is a sample Activity',	'2026-01-22 05:45:00',	'2026-01-22 05:45:00');

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
  KEY `fk_submission_grader` (`graded_by`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_student` (`student_id`),
  KEY `idx_graded` (`graded_at`),
  CONSTRAINT `fk_sub_activity` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `fk_submission_grader` FOREIGN KEY (`graded_by`) REFERENCES `users` (`ID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `activity_submissions` (`id`, `activity_id`, `student_id`, `file_path`, `original_name`, `mime_type`, `score`, `graded_at`, `graded_by`, `created_at`, `updated_at`) VALUES
(1,	1,	2,	'1767596230573__Activity_9.pdf',	'Activity 9.pdf',	'application/pdf',	98.00,	'2026-01-05 14:57:34',	1,	'2026-01-05 14:57:10',	'2026-01-05 14:57:34');

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
(1,	'Advisory',	'ICT-A2',	'CmjkLbWzAE',	1,	'2026-01-05 06:50:08',	'2025-2026',	NULL),
(2,	'Sample Classroom',	'ICT-A2',	'14R8WDFxDK',	5,	'2026-01-22 05:43:39',	'2025-2026',	NULL);

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
(1,	1,	2,	'2026-01-05 06:52:23',	'accepted',	'CmjkLbWzAE',	'Advisory'),
(2,	2,	6,	'2026-01-22 05:43:46',	'accepted',	'14R8WDFxDK',	'Sample Classroom');

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
(2,	1,	1,	1,	'Hi',	'2026-01-05 14:55:47',	'2026-01-05 14:55:47',	0);

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
(2,	2,	2,	'Hello',	'2026-01-05 14:56:10',	'2026-01-05 14:56:10',	0);

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
  `type` enum('invite','quiz','system','grade') DEFAULT 'system',
  `message` text NOT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `notifications` (`id`, `recipient_id`, `sender_id`, `type`, `message`, `link`, `is_read`, `created_at`, `updated_at`) VALUES
(1,	2,	1,	'invite',	'You\'ve been invited to join classroom CmjkLbWzAE',	'/classrooms/CmjkLbWzAE',	0,	'2026-01-05 14:52:23',	'0000-00-00 00:00:00'),
(2,	2,	1,	'grade',	'Your activity \"Activity\" was graded 98/100.',	'/activity/1/view',	1,	'2026-01-05 14:57:51',	'2026-01-05 14:57:51'),
(3,	2,	1,	'grade',	'Your quiz \"Sample Quiz\" was graded.',	'/quizzes/CmjkLbWzAE/quizzes/1/results',	1,	'2026-01-05 15:12:38',	'2026-01-05 15:12:38'),
(4,	6,	5,	'invite',	'You\'ve been invited to join classroom 14R8WDFxDK',	'/classrooms/14R8WDFxDK',	0,	'2026-01-22 13:43:46',	'0000-00-00 00:00:00');

DROP TABLE IF EXISTS `quizzes`;
CREATE TABLE `quizzes` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `classroom_id` int(11) NOT NULL,
  `teacher_id` int(10) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `questions` text DEFAULT NULL,
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
(1,	1,	1,	'Sample Quiz',	NULL,	0,	3,	NULL,	NULL,	3600,	'2026-01-05 07:03:19',	'0000-00-00 00:00:00'),
(3,	2,	5,	'Sample Quiz',	NULL,	0,	5,	NULL,	NULL,	3600,	'2026-01-22 05:48:49',	'0000-00-00 00:00:00');

DROP TABLE IF EXISTS `quiz_attempts`;
CREATE TABLE `quiz_attempts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `quiz_id` int(10) unsigned NOT NULL,
  `student_id` int(10) unsigned NOT NULL,
  `attempt_no` int(10) unsigned NOT NULL,
  `answers` mediumtext DEFAULT NULL,
  `score` int(11) DEFAULT NULL,
  `grading` mediumtext DEFAULT NULL,
  `comment` varchar(255) DEFAULT NULL,
  `graded_at` timestamp NULL DEFAULT NULL,
  `grader_id` int(11) DEFAULT NULL,
  `status` enum('in_progress','needs_grading','completed') NOT NULL DEFAULT 'in_progress',
  `started_at` datetime NOT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quiz_student_attempt` (`quiz_id`,`student_id`,`attempt_no`),
  KEY `quiz_id` (`quiz_id`),
  KEY `student_id` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `quiz_attempts` (`id`, `quiz_id`, `student_id`, `attempt_no`, `answers`, `score`, `grading`, `comment`, `graded_at`, `grader_id`, `status`, `started_at`, `submitted_at`, `expires_at`) VALUES
(13,	1,	1,	1,	'{\"q-eo4u002\":\"0\",\"q-qx5uxy1\":\"sdawdw\",\"q-zobxd32\":\"ddefef\",\"q-6d1ge9v\":[\"0\",\"1\",\"2\",\"3\"]}',	NULL,	'{\"q-eo4u002\":{\"correct\":true,\"given\":\"0\",\"expected\":\"0\",\"scored\":true},\"q-qx5uxy1\":{\"requiresManualGrading\":true,\"answer\":\"sdawdw\",\"scored\":false},\"q-zobxd32\":{\"requiresManualGrading\":true,\"answer\":\"ddefef\",\"scored\":false},\"q-6d1ge9v\":{\"correct\":true,\"given\":[\"0\",\"1\",\"2\",\"3\"],\"expected\":[0,1,2,3],\"scored\":true}}',	NULL,	NULL,	NULL,	'needs_grading',	'2026-01-22 00:04:43',	'2026-01-22 00:29:02',	'2026-01-22 01:04:43'),
(14,	3,	5,	1,	'{\"q-pdbk0kf\":\"sdwrw\",\"q-1qqmxlv\":\"0\",\"q-x1vnhon\":\"feafadf\",\"q-vb5s52j\":[\"0\",\"1\",\"2\",\"3\"]}',	NULL,	'{\"q-pdbk0kf\":{\"correct\":false,\"given\":\"sdwrw\",\"expected\":\"this is a sample quiz\",\"scored\":true},\"q-1qqmxlv\":{\"correct\":true,\"given\":\"0\",\"expected\":\"0\",\"scored\":true},\"q-x1vnhon\":{\"requiresManualGrading\":true,\"answer\":\"feafadf\",\"scored\":false},\"q-vb5s52j\":{\"correct\":true,\"given\":[\"0\",\"1\",\"2\",\"3\"],\"expected\":[0,1,2,3],\"scored\":true}}',	NULL,	NULL,	NULL,	'needs_grading',	'2026-01-22 16:02:11',	'2026-01-22 16:02:28',	'2026-01-22 17:02:11'),
(15,	3,	5,	2,	'{}',	NULL,	NULL,	NULL,	NULL,	NULL,	'in_progress',	'2026-01-22 16:02:36',	NULL,	'2026-01-22 17:02:36'),
(16,	3,	5,	3,	'{}',	NULL,	NULL,	NULL,	NULL,	NULL,	'in_progress',	'2026-01-22 17:03:56',	NULL,	'2026-01-22 18:03:56');

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
(1,	1,	0,	'Page 1',	'{\"questions\":[{\"id\":\"q-eo4u002\",\"type\":\"multiple_choice\",\"text\":\"Sample question 1\",\"requiresManualGrading\":false,\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":\"0\"}]}',	'2026-01-05 07:03:19'),
(2,	1,	1,	'Page 2',	'{\"questions\":[{\"id\":\"q-qx5uxy1\",\"type\":\"short_answer\",\"text\":\"Sample question 2\",\"requiresManualGrading\":true,\"sentenceLimit\":1,\"correctAnswer\":\"\"}]}',	'2026-01-05 07:03:19'),
(3,	1,	2,	'Page 3',	'{\"questions\":[{\"id\":\"q-zobxd32\",\"type\":\"paragraph\",\"text\":\"Sample question 3\",\"requiresManualGrading\":true,\"sentenceLimit\":3,\"correctAnswer\":\"\"}]}',	'2026-01-05 07:03:19'),
(4,	1,	3,	'Page 4',	'{\"questions\":[{\"id\":\"q-6d1ge9v\",\"type\":\"checkboxes\",\"text\":\"Sample question 4\",\"requiresManualGrading\":false,\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[0,1,2,3]}]}',	'2026-01-05 07:03:19'),
(25,	3,	0,	'Page 2',	'{\"questions\":[{\"id\":\"q-pdbk0kf\",\"type\":\"short_answer\",\"text\":\"This is a sample question 2\",\"requiresManualGrading\":false,\"sentenceLimit\":2,\"correctAnswer\":\"this is a sample quiz\"},{\"id\":\"q-991bkpq\",\"type\":\"multiple_choice\",\"text\":\"New question\",\"requiresManualGrading\":false,\"options\":[\"a\",\"a\",\"a\",\"a\"],\"correctAnswer\":\"0\"},{\"id\":\"q-ov8fz0p\",\"type\":\"multiple_choice\",\"text\":\"New question\",\"requiresManualGrading\":false,\"options\":[\"b\",\"b\",\"b\",\"b\"],\"correctAnswer\":\"2\"}]}',	'2026-01-22 08:18:33'),
(26,	3,	1,	'Page 1',	'{\"questions\":[{\"id\":\"q-1qqmxlv\",\"type\":\"multiple_choice\",\"text\":\"This is a sample question 1\",\"requiresManualGrading\":false,\"options\":[\"sample answer 1\",\"sample answer 2\",\"sample answer 3\",\"sample answer 4\"],\"correctAnswer\":\"0\"},{\"id\":\"q-24zr0hf\",\"type\":\"multiple_choice\",\"text\":\"New question\",\"requiresManualGrading\":false,\"options\":[\"a\",\"b\",\"c\",\"d\"],\"correctAnswer\":\"2\"}]}',	'2026-01-22 08:18:33'),
(27,	3,	2,	'Page 3',	'{\"questions\":[{\"id\":\"q-x1vnhon\",\"type\":\"paragraph\",\"text\":\"This is a sample question 3\",\"requiresManualGrading\":true,\"sentenceLimit\":3,\"correctAnswer\":\"You can also answer anything here, this just have longer minimum sentence required\"},{\"id\":\"q-b03bfr5\",\"type\":\"multiple_choice\",\"text\":\"New question\",\"requiresManualGrading\":false,\"options\":[\"1\",\"2\",\"3\",\"4\"],\"correctAnswer\":\"0\"}]}',	'2026-01-22 08:18:33'),
(28,	3,	3,	'Page 4',	'{\"questions\":[{\"id\":\"q-vb5s52j\",\"type\":\"checkboxes\",\"text\":\"This is a sample question 4\",\"requiresManualGrading\":false,\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[0,1,2,3]},{\"id\":\"q-l6oie1x\",\"type\":\"multiple_choice\",\"text\":\"New question\",\"requiresManualGrading\":false,\"options\":[\"2\",\"3\",\"5\",\"6\"],\"correctAnswer\":\"0\"}]}',	'2026-01-22 08:18:33');

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
(1,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njc1OTU3NTMsImV4cCI6MTc2NzY4MjE1M30.ZtuhbBs2X8TtQkKeVmzMA7gnklkPnL_DqzrV7jJTZKA',	'2026-01-06 14:49:13'),
(2,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3Njc1OTU5MjAsImV4cCI6MTc2NzY4MjMyMH0.Yu5yYKhn3jXsGppILRMaLPT72KbVapTC1K_WJTNxXx8',	'2026-01-06 14:52:00'),
(3,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3Njc1OTcyNTYsImV4cCI6MTc2NzY4MzY1Nn0.VAgSmpBMb8sw5I3Pw1Kb2nJoCN2Wx4fE3JYiB-B991c',	'2026-01-06 15:14:16'),
(4,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3Njc1OTcyNzUsImV4cCI6MTc2NzY4MzY3NX0.41cnChT4R1_l0iu3BL6obSk0GM80qm6iQcfNezTsP7I',	'2026-01-06 15:14:35'),
(5,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3Njc1OTc1OTYsImV4cCI6MTc2NzY4Mzk5Nn0.KE7AapHeEFwTblQSi--DUO0tOtAlsvi630cFj3dadTM',	'2026-01-06 15:19:56'),
(6,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg3OTEwNzUsImV4cCI6MTc2ODg3NzQ3NX0.klSJ-qzrsjQknHm-W2XheZewXiqNPqCxTaNLo8Fe-Wc',	'2026-01-20 10:51:15'),
(7,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg3OTg1NDMsImV4cCI6MTc2ODg4NDk0M30.hiG1JIpDUissgVkSXmc5kcOw_FWl1G8trZpbTzpof9A',	'2026-01-20 12:55:43'),
(8,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg3OTg2NTUsImV4cCI6MTc2ODg4NTA1NX0.BwnKhXXyLkTkBbtMq-M8v3Cpt6DBeSRY-X4f8tXcXqs',	'2026-01-20 12:57:35'),
(9,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg3OTg3MjksImV4cCI6MTc2ODg4NTEyOX0.ZtrevvZJ5xa8ZXpDMR1iS9sJgCkrTfZWNwVhRmUBQsE',	'2026-01-20 12:58:49'),
(10,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg3OTkyOTcsImV4cCI6MTc2ODg4NTY5N30.F22Re8dVDZycOlzCCS4JSc5UsYY7U1DZ1sarROIDVko',	'2026-01-20 13:08:17'),
(11,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg4MDEzODgsImV4cCI6MTc2ODg4Nzc4OH0.xkQLYWAT1hOEeGTNrugmvoSLKmeufILPEobGFgW3c7Y',	'2026-01-20 13:43:08'),
(12,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg4MDE0MTAsImV4cCI6MTc2ODg4NzgxMH0.rSSwK6EArL2k31yfhZ59iBzhZysVU20mmSknOj9Cw6k',	'2026-01-20 13:43:30'),
(13,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg4MDE0MzcsImV4cCI6MTc2ODg4NzgzN30.aR1WXpUoz4whNQi6Sr6VzVitkMv7BCGXchB2YsgTGLs',	'2026-01-20 13:43:57'),
(14,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODU0MTksImV4cCI6MTc2OTA3MTgxOX0.InnnQE0xhq_JI4ZIaFvcwthwbtzUjeY1TYJM8CW5_PY',	'2026-01-22 16:50:19'),
(15,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODY3ODMsImV4cCI6MTc2OTA3MzE4M30._4aePCDzfAGU31vRVGUH_aT1R8dWr-NaVAJqdO0zOLE',	'2026-01-22 17:13:03'),
(16,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODc3MDAsImV4cCI6MTc2OTA3NDEwMH0.tZHjUjyKv_R3dgtdiiMOdt8DPuSwEEZ3B6wloDtRolo',	'2026-01-22 17:28:20'),
(17,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODg2NjEsImV4cCI6MTc2OTA3NTA2MX0.Jo-QNzicAWfH39yTfjbVDCpEQbyDrgvU6BsVQgpYt-E',	'2026-01-22 17:44:21'),
(18,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODg3MDYsImV4cCI6MTc2OTA3NTEwNn0.LAeV49OkQ_fKN2E5J5F3TTR8H9sZ5KzplF-5Drv7vHI',	'2026-01-22 17:45:06'),
(19,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODg3MjQsImV4cCI6MTc2OTA3NTEyNH0.PU9sEKM8t_2keYe2rI3b6-68AgX_0bKreV7pMdmq6qw',	'2026-01-22 17:45:24'),
(20,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODg5ODIsImV4cCI6MTc2OTA3NTM4Mn0.DuInhJVEqUttlTrMJy1Q6WKi7E5Kt46mAH-EybpmFKg',	'2026-01-22 17:49:42'),
(21,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODkyNDksImV4cCI6MTc2OTA3NTY0OX0.vKUdUdnpwW5YtbUFaN8J7FWX3tQJd92R21WS9jrSFCM',	'2026-01-22 17:54:09'),
(22,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk0MTgsImV4cCI6MTc2OTA3NTgxOH0.PQPfr5475_AjnR1kjpK8gEivu3FMyX7hfhgpKJgf0TI',	'2026-01-22 17:56:58'),
(23,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk0NTEsImV4cCI6MTc2OTA3NTg1MX0.MWToy6U9QP-t8RARG5F6uWmZGrT020jzJAaZWae066o',	'2026-01-22 17:57:31'),
(24,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk0NzUsImV4cCI6MTc2OTA3NTg3NX0.3CX_8KH_hp7ZjLtefifIuJQMJoHCR60WqEUuaQHcLw0',	'2026-01-22 17:57:55'),
(25,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk0OTcsImV4cCI6MTc2OTA3NTg5N30.J-B4mA1ifTN_B6WsjfTqw9mFox8ku1tSo659oUS-cnk',	'2026-01-22 17:58:17'),
(26,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk2ODIsImV4cCI6MTc2OTA3NjA4Mn0.nZoVlYcJ31n_QSbCQYHHBdyADR8RxbqGsOYAOl3XyNw',	'2026-01-22 18:01:22'),
(27,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk3MDQsImV4cCI6MTc2OTA3NjEwNH0.M9IVzKav9v2BjLKjyiC_WmgumiV4yKBI5NuUzTCEL7Y',	'2026-01-22 18:01:44'),
(28,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk5NzQsImV4cCI6MTc2OTA3NjM3NH0.58Zwal4L9eWRQYe0fp2mkXDEPxWVLKKwHLJW_htpzCk',	'2026-01-22 18:06:14'),
(29,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5ODk5OTYsImV4cCI6MTc2OTA3NjM5Nn0.VYFg_C_7nv6whKk6v8K2vBu6GW0pqnEF7C0gsq3cCZU',	'2026-01-22 18:06:36'),
(30,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5OTAzODQsImV4cCI6MTc2OTA3Njc4NH0.L93K57Kvm79EERy9g8PQWvzuOPRgWxN97XFqF1I9dS8',	'2026-01-22 18:13:04'),
(31,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5OTA4NTksImV4cCI6MTc2OTA3NzI1OX0.0Ij4mhCPObGvHU20v5P_l4rTblg6loRJoXNYzlanJbI',	'2026-01-22 18:20:59'),
(32,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5OTEwNzQsImV4cCI6MTc2OTA3NzQ3NH0.zc3klzYEAZKIHZgesLMMI8K9Yb0a9vD3mhTEqPjv9jE',	'2026-01-22 18:24:34'),
(33,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3Njg5OTUzOTAsImV4cCI6MTc2OTA4MTc5MH0.JEcFhrL2RblBzAoKJvcoZZwLCrWq93iptlOvmhtNirM',	'2026-01-22 19:36:30'),
(34,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3Njg5OTkwODgsImV4cCI6MTc2OTA4NTQ4OH0.JttDuxRBKf4AJ3NMNhMsIGWFCd_aY8YWhgY0y0qV-1g',	'2026-01-22 20:38:08'),
(35,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwMDgzOTcsImV4cCI6MTc2OTA5NDc5N30.ZJE0zj3qN8tgPO4PVzx7RPbfKs1FAZfe9aKGZhnNI40',	'2026-01-22 23:13:17'),
(36,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3NjkwMDk1NTUsImV4cCI6MTc2OTA5NTk1NX0.auRJzX-mK1CD6c77I2PzVDY5fLmGX0hCWABbbbo5AWY',	'2026-01-22 23:32:35'),
(37,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNTEzMDMsImV4cCI6MTc2OTEzNzcwM30.zMCnLflJpM8xZGzYn0EIvRRXz5ouSEKYTuIYDZDoEqk',	'2026-01-23 11:08:23'),
(39,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNjA0OTQsImV4cCI6MTc2OTE0Njg5NH0.2QigU10guQ9Jl6QN8XxI0CY3OZokT98p9OUR1zksiHw',	'2026-01-23 13:41:34'),
(40,	6,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoibmlrb3ljdXRlN0BnbWFpbC5jb20iLCJyb2xlIjoic3R1ZGVudCIsInVzZXJuYW1lIjoic2FtcGxlU3R1ZGVudCIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3NjkwNjA1NjUsImV4cCI6MTc2OTE0Njk2NX0.nyRiP2xGUYjS4H4rcOWbjccNzbYEN9-D169KWUAHqbQ',	'2026-01-23 13:42:45'),
(41,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNjA1OTYsImV4cCI6MTc2OTE0Njk5Nn0.vKj7PHhYmBw434ooZQZHpW_nmkxR7Z9iimKFpTO_LQw',	'2026-01-23 13:43:16'),
(42,	6,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoibmlrb3ljdXRlN0BnbWFpbC5jb20iLCJyb2xlIjoic3R1ZGVudCIsInVzZXJuYW1lIjoic2FtcGxlU3R1ZGVudCIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3NjkwNjA2NDYsImV4cCI6MTc2OTE0NzA0Nn0.BivItxHQ3u2Ty7SgaCMsVTQXUXAWQQG82QR-70RVyig',	'2026-01-23 13:44:06'),
(43,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNjA2ODAsImV4cCI6MTc2OTE0NzA4MH0.QxWa8nqqu4qt0ftFgdgDQOqlff_ql9DmRsvpA7Ej7XU',	'2026-01-23 13:44:40'),
(44,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3NjkwNjgxMjAsImV4cCI6MTc2OTE1NDUyMH0._WK-PfmvlMt66Jxji4R1GlPoEr_egWUAyAnWEHeiIzU',	'2026-01-23 15:48:40'),
(45,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNjgyMDYsImV4cCI6MTc2OTE1NDYwNn0.3jJkop66vGLgW1Nad6ML2veWHQ4miF43Q_OVaRBCoC4',	'2026-01-23 15:50:06'),
(46,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNzU1NTksImV4cCI6MTc2OTE2MTk1OX0.gQolPjBhVJyeAKgKSrocBi0_PdlTkFhvKrTb5_xqJks',	'2026-01-23 17:52:39'),
(47,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNzY1OTYsImV4cCI6MTc2OTE2Mjk5Nn0.bx5OZ0q39R9gXp_8OxoRatrClq748yK22oXPxe7_SuA',	'2026-01-23 18:09:56'),
(48,	5,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoibmlrb3NhY3JvNkBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsInVzZXJuYW1lIjoic2Fjcm8iLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNzY5MzIsImV4cCI6MTc2OTE2MzMzMn0.lk9lJF132jE37wLxFwizN08JZOKHUI5mKTMaqa0isDw',	'2026-01-23 18:15:32'),
(49,	1,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoia2VpdGh2aXJnZW5lczE3QGdtYWlsLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwidXNlcm5hbWUiOiIxMzFmZ2giLCJzZWN0aW9uIjpudWxsLCJpYXQiOjE3NjkwNzY5NDIsImV4cCI6MTc2OTE2MzM0Mn0.kxM5bw3CDznjiQ5f2LjB1dAfV-SGRatyyB-RwWX6eNI',	'2026-01-23 18:15:42'),
(50,	2,	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoianVzdGluZWFiZG9uNzFAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJ1c2VybmFtZSI6IjEzMWZnaiIsInNlY3Rpb24iOiJJQ1QtQTIiLCJpYXQiOjE3NjkwNzg1MzIsImV4cCI6MTc2OTE2NDkzMn0.9n1cWFW5qBYI6D-eyLd8KXF0-nfNZxFMJk4m_G45Sy8',	'2026-01-23 18:42:12');

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
(1,	'keithvirgenes17@gmail.com',	'131fgh',	NULL,	'$2b$10$Wc5PEODVKQUr8g1tbucUbuyZvT2D60h1MneVadCtHe1iq1.jtru3y',	'teacher',	NULL,	NULL,	0),
(2,	'justineabdon71@gmail.com',	'131fgj',	'ICT-A2',	'$2b$10$oXd0VRA0jDUhaPgcYDGQROCg93bDFNR7UtK68gBMM9YJNI7I95j8u',	'student',	NULL,	NULL,	0),
(5,	'nikosacro6@gmail.com',	'sacro',	NULL,	'$2b$10$MO79gs3dtS1oKse.AqTStu57MHmoPHPYQcKuYniow3pz9ARMpTdKe',	'teacher',	NULL,	NULL,	0),
(6,	'nikoycute7@gmail.com',	'sampleStudent',	'ICT-A2',	'$2b$10$.5a79K1yP0xAYRi8P28Bv.B2Vekj.5X58Jc08JnTDJwFUc6.cefLe',	'student',	NULL,	NULL,	0);

-- 2026-01-22 13:47:32 UTC
