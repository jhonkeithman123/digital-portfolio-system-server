-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 31, 2025 at 11:05 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `digital_portfolio_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `classrooms`
--

CREATE TABLE `classrooms` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(10) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `school_year` varchar(20) NOT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `classrooms`
--

INSERT INTO `classrooms` (`id`, `name`, `code`, `teacher_id`, `created_at`, `school_year`, `updated_at`) VALUES
(5, 'Advisory', 'mUq0oFzlui', 4, '2025-10-07 10:42:43', '2025-2026', '0000-00-00 00:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `classroom_members`
--

CREATE TABLE `classroom_members` (
  `id` int(11) NOT NULL,
  `classroom_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `classroom_members`
--

INSERT INTO `classroom_members` (`id`, `classroom_id`, `student_id`, `joined_at`, `status`, `code`, `name`) VALUES
(5, 5, 3, '2025-10-24 14:12:29', 'accepted', 'mUq0oFzlui', 'Advisory');

-- --------------------------------------------------------

--
-- Table structure for table `hidden_invites`
--

CREATE TABLE `hidden_invites` (
  `id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `invite_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `logging`
--

CREATE TABLE `logging` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `log` varchar(255) NOT NULL,
  `detected_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `recipient_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `type` enum('invite','quiz','feedback','system') DEFAULT 'system',
  `message` text NOT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `recipient_id`, `sender_id`, `type`, `message`, `link`, `is_read`, `created_at`) VALUES
(1, 3, 4, 'invite', 'You\'ve been invited to join classroom mUq0oFzlui', '/classrooms/mUq0oFzlui', 0, '2025-10-22 14:17:31'),
(2, 3, 4, 'invite', 'You\'ve been invited to join classroom mUq0oFzlui', '/classrooms/mUq0oFzlui', 0, '2025-10-22 14:18:36'),
(3, 3, 4, 'invite', 'You\'ve been invited to join classroom mUq0oFzlui', '/classrooms/mUq0oFzlui', 0, '2025-10-24 22:12:29');

-- --------------------------------------------------------

--
-- Table structure for table `quizzes`
--

CREATE TABLE `quizzes` (
  `id` int(11) UNSIGNED NOT NULL,
  `classroom_id` int(11) NOT NULL,
  `teacher_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `questions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`questions`)),
  `attempts` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `attempts_allowed` int(10) UNSIGNED DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `time_limit_seconds` int(11) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizzes`
--

INSERT INTO `quizzes` (`id`, `classroom_id`, `teacher_id`, `title`, `questions`, `attempts`, `attempts_allowed`, `start_time`, `end_time`, `time_limit_seconds`, `created_at`) VALUES
(3, 5, 4, 'Sample Quiz', '{\"pages\":[{\"id\":\"page-1\",\"title\":\"Page 1\",\"questions\":[{\"id\":\"q-8wxh30d\",\"type\":\"multiple_choice\",\"text\":\"Sample Question 1\",\"options\":[\"1\",\"2\",\"3\",\"4\"],\"correctAnswer\":\"0\"}]},{\"id\":\"page-2\",\"title\":\"Page 2\",\"questions\":[{\"id\":\"q-iy3ml4x\",\"type\":\"short_answer\",\"text\":\"Sample Question 2\",\"sentenceLimit\":3,\"correctAnswer\":\"\"}]},{\"id\":\"page-3\",\"title\":\"Page 3\",\"questions\":[{\"id\":\"q-487ismk\",\"type\":\"paragraph\",\"text\":\"Sample Question 3\",\"sentenceLimit\":4,\"correctAnswer\":\"\"}]},{\"id\":\"page-4\",\"title\":\"Page 4\",\"questions\":[{\"id\":\"q-bui692b\",\"type\":\"checkboxes\",\"text\":\"Sample Question 4\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[0,1,2,3]}]}]}', 0, 2, NULL, NULL, 3600, '2025-10-31 08:57:06'),
(4, 5, 4, 'Sample Quiz 2', '{\"pages\":[{\"id\":\"page-13\",\"title\":\"Page 1\",\"questions\":[{\"id\":\"q-yvz4xof\",\"type\":\"multiple_choice\",\"text\":\"Sample Quiz 2\",\"options\":[\"1\",\"2\",\"3\",\"4\"],\"correctAnswer\":null}]},{\"id\":\"page-14\",\"title\":\"Page 2\",\"questions\":[{\"id\":\"q-bcartiv\",\"type\":\"short_answer\",\"text\":\"Sample Quiz 1\",\"sentenceLimit\":3,\"correctAnswer\":\"none\"}]},{\"id\":\"page-15\",\"title\":\"Page 3\",\"questions\":[{\"id\":\"q-3jpvxty\",\"type\":\"paragraph\",\"text\":\"Sample Quiz 3\",\"sentenceLimit\":7,\"correctAnswer\":\"lol\"}]},{\"id\":\"page-16\",\"title\":\"Page 4\",\"questions\":[{\"id\":\"q-hsmejil\",\"type\":\"checkboxes\",\"text\":\"Sample Quiz 4\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[0,1,2,3]}]}]}', 0, 1, NULL, NULL, NULL, '2025-10-31 08:59:22');

-- --------------------------------------------------------

--
-- Table structure for table `quiz_attempts`
--

CREATE TABLE `quiz_attempts` (
  `id` int(10) UNSIGNED NOT NULL,
  `quiz_id` int(10) UNSIGNED NOT NULL,
  `student_id` int(10) UNSIGNED NOT NULL,
  `attempt_no` int(10) UNSIGNED NOT NULL,
  `answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`answers`)),
  `score` int(11) DEFAULT NULL,
  `status` enum('in_progress','completed','expired') NOT NULL DEFAULT 'in_progress',
  `started_at` datetime NOT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `session`
--

CREATE TABLE `session` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `session`
--

INSERT INTO `session` (`id`, `user_id`, `token`, `expires_at`) VALUES
(15, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTM1MjMsImV4cCI6MTc1ODk2MDcyM30.4n1XM8qc_19x0I9S8FkqnHF3X9LFt5UQYbsn4JrxgyI', '2025-09-27 16:12:03'),
(16, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTQwNjgsImV4cCI6MTc1ODk2MTI2OH0.8tH4GvPcOxBHiG0n20zY9R9F-FOQY7ItAQdF86jBtK8', '2025-09-27 16:21:08'),
(17, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTQyNjIsImV4cCI6MTc1ODk2MTQ2Mn0.heDx0bM70hthIngPlq7iPFhcYJhc_UuUKatDC56ss-Y', '2025-09-27 16:24:22'),
(18, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTQ4MzUsImV4cCI6MTc1ODk2MjAzNX0.E72pjan_otnjgRl0rc8tr-gHAkOAyxTPcdekSt4fV4E', '2025-09-27 16:33:55'),
(19, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTUyNTgsImV4cCI6MTc1ODk2MjQ1OH0.u2zc7ZU9e75aA429DuZxY3AtyGjT8AySDj3MgBghxYg', '2025-09-27 16:40:58'),
(20, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTU3MDUsImV4cCI6MTc1ODk2MjkwNX0.bgPHqDt-zm7qHS9ITtPRI3PIMlDHIY1_i09lu6weePA', '2025-09-27 16:48:25'),
(21, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTYyNzksImV4cCI6MTc1ODk2MzQ3OX0.JJi-d5XaGbBqsOlZHe8db_I47oErfTjAge3N0iQTiSY', '2025-09-27 16:57:59'),
(22, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTYzMjQsImV4cCI6MTc1ODk2MzUyNH0.Dm8yDasdHsjYvmMPFFQQaADlMbX5Og_Seo3zDKJdClM', '2025-09-27 16:58:44'),
(23, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTY0MTEsImV4cCI6MTc1ODk2MzYxMX0.FhEoUQkAyKCPMWyYItKyIY2K3R_X8_UBRe1koYJ2Ggo', '2025-09-27 17:00:11'),
(24, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTY0NDAsImV4cCI6MTc1ODk2MzY0MH0.RVZVtnbjM9jqjqy2GBPI_DWlYKAjb6f8qg02r9KFnh4', '2025-09-27 17:00:40'),
(25, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTg0MzcsImV4cCI6MTc1ODk2NTYzN30.SfGezZOzZbCx7xUFxnRz2UA4OQ1gDazXxWAoeg8Oqc8', '2025-09-27 17:33:57'),
(26, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTg2MjYsImV4cCI6MTc1ODk2NTgyNn0.i0aOryKhudf-gAM1aRYTI3TlV70zNE1sZnvW5udx21Y', '2025-09-27 17:37:06'),
(27, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTg4NDQsImV4cCI6MTc1ODk2NjA0NH0.tkK5903nb_3uTH-1RFMWYXV-u0Z5uMzuPQamW1h25v4', '2025-09-27 17:40:44'),
(28, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTg4NjMsImV4cCI6MTc1ODk2NjA2M30.dJow7ong7YjXfth0wRwI3ZYAmvIfHHMS9Mw6WlZK7rk', '2025-09-27 17:41:03'),
(29, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTkwNTMsImV4cCI6MTc1ODk2NjI1M30.Dc2cyyK_H18bPjkAs3G0iTtTQ0DbZ7waWjcwPAq8iTU', '2025-09-27 17:44:13'),
(30, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTkyNTUsImV4cCI6MTc1ODk2NjQ1NX0.9N0pQC0FdKvrQYhU6FySMAScVlRJXz6wHhjPxXskdLc', '2025-09-27 17:47:35'),
(31, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTkzNzYsImV4cCI6MTc1ODk2NjU3Nn0.bNVl1p5Eh9dApqmkoX1sCeJ2g_zBEWJW9qeN4QYcVRU', '2025-09-27 17:49:36'),
(32, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTkzOTIsImV4cCI6MTc1ODk2NjU5Mn0.EFcL5kX5T9q_7uq59FmDLn_nEpmPOrkFH7RjYKs1yTs', '2025-09-27 17:49:52'),
(33, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NTk0OTMsImV4cCI6MTc1ODk2NjY5M30.7r8so-SbtYOrXDbvI7VdDO0-GUOMiJL0ajw58L4I7DU', '2025-09-27 17:51:33'),
(34, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NjUwNDEsImV4cCI6MTc1ODk3MjI0MX0.GyK5HaeequnmQJz-BVXi7sPI6KTVjw-XmJZApA5t2dQ', '2025-09-27 19:24:01'),
(35, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTg5NjcyODUsImV4cCI6MTc1ODk3NDQ4NX0.62uYoyPCGYF3HnX3HHhOD9TGZ87PxKqn2XZ_u_LjcWQ', '2025-09-27 20:01:25'),
(36, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTg5NjczODEsImV4cCI6MTc1ODk3NDU4MX0.Wv_mjPwtfvrKBHKideQrqdiMN0MbegHxwj5GQ4HpNM4', '2025-09-27 20:03:01'),
(37, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTg5Njg0OTcsImV4cCI6MTc1ODk3NTY5N30.yZcD0S5e69X36usure6AWm2GVBThRU6FN3vmukznctQ', '2025-09-27 20:21:37'),
(38, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkwNzE3MjMsImV4cCI6MTc1OTA3ODkyM30.cIuXAsxk94atPA0BO6GKCFF-OjUonavvQLpnS2HIOo8', '2025-09-29 01:02:03'),
(39, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTkwNzE3NzcsImV4cCI6MTc1OTA3ODk3N30.phYXmaq1RQQ1znh1QEONc6DFlFQpS9Yj4WHAg6s90kQ', '2025-09-29 01:02:57'),
(40, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTQ4NDIsImV4cCI6MTc1OTEyMjA0Mn0.N3JySBZINp8nYAvl4P57YW26gb6QHIH0ohZ93P1N1_c', '2025-09-29 13:00:42'),
(41, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTQ4NTcsImV4cCI6MTc1OTEyMjA1N30.pJcXcXTBN4sRICfkz6WwXw8JLH97fmdckYWzzl_hW0U', '2025-09-29 13:00:57'),
(42, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTUyNDEsImV4cCI6MTc1OTEyMjQ0MX0.8j7FtjPNrpz6LmzKSbMtnxX-7cBoDTkmfOBPgec3JcQ', '2025-09-29 13:07:21'),
(43, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTYwMzEsImV4cCI6MTc1OTEyMzIzMX0.AFMMl_BQfYUxNZr0tn2MfRmwCdW4DiEfoEBYNFsBBOo', '2025-09-29 13:20:31'),
(44, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTc1NDUsImV4cCI6MTc1OTEyNDc0NX0.QP2L0worFfoyEpVAB0gBfrpEu_n2r-7lpTi2HipvN-c', '2025-09-29 13:45:45'),
(45, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTc2MDgsImV4cCI6MTc1OTEyNDgwOH0.jS7GmJplLCaMuOnoB-77mF0yat8lIPAZ1eVhUW5-Gnk', '2025-09-29 13:46:48'),
(46, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTc3MTAsImV4cCI6MTc1OTEyNDkxMH0.Zr4eOHv7XPdxH91E4RA6E_3fOUs029fwgp-HPeZTbtw', '2025-09-29 13:48:30'),
(47, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTc4MjAsImV4cCI6MTc1OTEyNTAyMH0.3oLw-qyJtwAsuZ22aeVO22CwU6RfXPYbo9SAjpHsoK4', '2025-09-29 13:50:20'),
(48, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTkxMTc5MDAsImV4cCI6MTc1OTEyNTEwMH0.oHEQm5v3UvX42_fB0sL_gpSqv3gyI4Xh006Vqw9-JXM', '2025-09-29 13:51:40'),
(49, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTkxMzcxMDMsImV4cCI6MTc1OTE0NDMwM30.sQDn2kffHlzQ1HBpQNHRiYBPxFcbmw3zN27TduiBTaA', '2025-09-29 19:11:43'),
(50, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk0MDIxNzAsImV4cCI6MTc1OTQwOTM3MH0.U_u_ycDPE52g-Q_p_CWwOKdv_gUTUoI-HqWJqm2s5pQ', '2025-10-02 20:49:30'),
(51, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk0MDI5NDksImV4cCI6MTc1OTQxMDE0OX0.Uei_W5X-0ZzYIxqLOslrCUoUx-trBRtJXX8f2hpNjP4', '2025-10-02 21:02:29'),
(52, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk0MDQ1NDksImV4cCI6MTc1OTQxMTc0OX0.1bA5B5GGRx0v2gqdW68aGL9jaUiVNGdkY3RI0Orir0M', '2025-10-02 21:29:09'),
(53, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk0MDkyNDAsImV4cCI6MTc1OTQxNjQ0MH0.4vUMn-zFBxv4Cq2hNULsB9gOEnics2fmJLr-2hTu2yQ', '2025-10-02 22:47:20'),
(54, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk0MDk1NDgsImV4cCI6MTc1OTQxNjc0OH0.Vs_yiVTicyYGDGyoXMwTbZs1IrFZR24eNsZVc8ICLiU', '2025-10-02 22:52:28'),
(55, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk4MzIxNTAsImV4cCI6MTc1OTgzOTM1MH0.RxdnzYKJhksT2ErFYOTy0Sr489j24KblK7lwRkzsswQ', '2025-10-07 20:15:50'),
(56, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzIxNjMsImV4cCI6MTc1OTgzOTM2M30.JPl6AUtepxzl9wg8Rhn9UdVuOeTsBtlo-UrJAEx0Y34', '2025-10-07 20:16:03'),
(57, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk4MzIyMjgsImV4cCI6MTc1OTgzOTQyOH0.I7EY-mp8lUKUZ6rnsQ1gwnfJjAXF5YfRz1DcV81V8aw', '2025-10-07 20:17:08'),
(58, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk4MzIyODMsImV4cCI6MTc1OTgzOTQ4M30._qDjyxRXdvTIUieU51ZqvdvQLKhm0Kmtayu0lhBj98k', '2025-10-07 20:18:03'),
(59, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk4MzIzMzAsImV4cCI6MTc1OTgzOTUzMH0.MuRA6AY34L8aCSaay8UQ664cRIexUC4ObzgmPQPJDp8', '2025-10-07 20:18:50'),
(60, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NTk4MzI1MTcsImV4cCI6MTc1OTgzOTcxN30.ZqVFiHiAzHMnxq8NaGDO-K3EHM-xbv3gI4vXAjMrZsA', '2025-10-07 20:21:57'),
(61, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzI1NDcsImV4cCI6MTc1OTgzOTc0N30.xBU9aqHqiITpYVaP90ztdUQ4hVoNiLbwopp7hhypd0M', '2025-10-07 20:22:27'),
(62, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzM5MDksImV4cCI6MTc1OTg0MTEwOX0.Et-pIVM9OdosSWxuJLdtNkjJp6Rgyl1Aif5HjgJfAbE', '2025-10-07 20:45:09'),
(63, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzQxMjAsImV4cCI6MTc1OTg0MTMyMH0.rPJLgCkGC6lLoqWXhhA3MVDjWT3uZacE5e7dGzFSxN0', '2025-10-07 20:48:40'),
(64, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzQxNTUsImV4cCI6MTc1OTg0MTM1NX0.Jtt19DsQH-X88Nosxd2aLVnbmk1sKcRI1sG9bfJix30', '2025-10-07 20:49:15'),
(65, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzQyNDQsImV4cCI6MTc1OTg0MTQ0NH0.hYPHKLKoFod7SbaF_RE9Oorv5XgKBqJdBS6vl8xJmFM', '2025-10-07 20:50:44'),
(66, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4MzkzNDgsImV4cCI6MTc1OTg0NjU0OH0.o5kGMUyA4Xhdwi2bgZtnYm3WksbfZ1wk41UALJgs_-0', '2025-10-07 22:15:48'),
(67, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4Mzk0NjcsImV4cCI6MTc1OTg0NjY2N30.zgVYkQrH-tNselTL-qWDZ7kJ-zf1SwO4Ela6ALK7isI', '2025-10-07 22:17:47'),
(68, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4NDAxMzEsImV4cCI6MTc1OTg0NzMzMX0.3SrsFeTTTIbrOwdtYnu_o9iGi_gvSlWYO-P2oxXR4FA', '2025-10-07 22:28:51'),
(69, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk4NDg1ODksImV4cCI6MTc1OTg1NTc4OX0.qVvpT0qLuiWdqaNMuFgx3VAx19R_LNFP8eSDHtENCBA', '2025-10-08 00:49:49'),
(70, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk5MDU2NjksImV4cCI6MTc1OTkxMjg2OX0.G4W8ZfiifazOlnj-ojxHPocriFTgxjSh1Q8HUkGzq8s', '2025-10-08 16:41:09'),
(71, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NTk5MDc2MDYsImV4cCI6MTc1OTkxNDgwNn0.HeatKtRXDQm9V_mPJYHQGpp-Jkf6iDIf2EayTx6YzXc', '2025-10-08 17:13:26'),
(72, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjAzNDM4NDIsImV4cCI6MTc2MDM1MTA0Mn0.paJzFyZKnyGF5_LYuc_ZD89EhV-JRc4xQCZGhnoh7-0', '2025-10-13 18:24:02'),
(73, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjEwMzI0ODQsImV4cCI6MTc2MTAzOTY4NH0.xEXNT1y5HGE0p3m3GDsytjT99cqA4uV0A74HjE4lBr8', '2025-10-21 17:41:24'),
(74, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjEwNTE4NTAsImV4cCI6MTc2MTA1OTA1MH0.gkrsmSvGq29t06HarplzKEY-n05YNW0KD7fnascBvuE', '2025-10-21 23:04:10'),
(75, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEwNTgwMTAsImV4cCI6MTc2MTA2NTIxMH0.vBNNwKJtidlfuMt1h1VIUOHO2uTcidjBVVjt9L6JSmY', '2025-10-22 00:46:50'),
(76, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDY3ODMsImV4cCI6MTc2MTExMzk4M30.QgcbTJ-HgzogRiMzOImDejXkN7oTaYMXnGQu1qfQSmU', '2025-10-22 14:19:43'),
(77, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMDY3OTksImV4cCI6MTc2MTExMzk5OX0.d3neNHrmDQW3agqrfI00StVTaEpbD66df4_fxxJWhCc', '2025-10-22 14:19:59'),
(78, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDY4MTYsImV4cCI6MTc2MTExNDAxNn0.ONp6b3TF3ksJYCrotSSwiRbEJOcv6LQlmRl8nY8y_7o', '2025-10-22 14:20:16'),
(79, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDcwODEsImV4cCI6MTc2MTExNDI4MX0.tixKDi2hMEAnITqugbN9M5hHKBxjX6d-9VUR1Ihv6ZA', '2025-10-22 14:24:41'),
(80, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDg2NjgsImV4cCI6MTc2MTExNTg2OH0.hdUrfcS_DgycpPVRrV7aaYr_HYBEdmiCekVGt8s4zVI', '2025-10-22 14:51:08'),
(81, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDkwODksImV4cCI6MTc2MTExNjI4OX0.nT7vKwipDlTRYQyY1Tp0IWYmpvO4wL2tJltBHet2XqE', '2025-10-22 14:58:09'),
(82, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDk1NTYsImV4cCI6MTc2MTExNjc1Nn0.sFsqPiXKCPexEiWNNYnc4lchEBUsBvjFNsfE7pM8fng', '2025-10-22 15:05:56'),
(83, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDk3MTMsImV4cCI6MTc2MTExNjkxM30.RjOCBgq8MHN7DnyGitGA_Qqc1c7RzW-T046UHCqHbJQ', '2025-10-22 15:08:33'),
(84, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMDk3MzYsImV4cCI6MTc2MTExNjkzNn0.__VZJIRqstmHYtAWPJqM39W5LJwxGJp5L4DWq-d17wA', '2025-10-22 15:08:56'),
(85, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMDk3NjUsImV4cCI6MTc2MTExNjk2NX0.QNMfl-V1NmbKtUpeTIQraxKAu8LAN_MQ4tJXzZH5kds', '2025-10-22 15:09:25'),
(86, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTA5NzEsImV4cCI6MTc2MTExODE3MX0.VJeTDwUVU4-tk5CcxYPtMn8yKcBVB007m2YmFTADt90', '2025-10-22 15:29:31'),
(87, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMTE2MjksImV4cCI6MTc2MTExODgyOX0.-q7XU3Mx-zhRRA_-J6iN-JRp5zkHAdsxLH4JCXrAwUk', '2025-10-22 15:40:29'),
(88, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTE2NDQsImV4cCI6MTc2MTExODg0NH0.Dg2-y90sHVtD8Zpf7o9NnKviV7TWL7Yl8tsG-FXTqxs', '2025-10-22 15:40:44'),
(89, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTE2OTEsImV4cCI6MTc2MTExODg5MX0.2HcshIn8sMWAbXoUdo2gSYiud78aeI4E-OTPEWqC1PE', '2025-10-22 15:41:31'),
(90, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMTMzNDEsImV4cCI6MTc2MTEyMDU0MX0.NtPVzmf8PeiuuSulNdRYHDAG8UiDD4kc16Nlh_039_U', '2025-10-22 16:09:01'),
(91, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTM4NjYsImV4cCI6MTc2MTEyMTA2Nn0.l3LjyuSZNOc4przJoQh2nWz4O5_sYK9WELJNnuXynsY', '2025-10-22 16:17:46'),
(92, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMTM5MTIsImV4cCI6MTc2MTEyMTExMn0.3lhwjVu-Sfug02DnNltE6q15P_5oJ3p7cm4KaCXGpOQ', '2025-10-22 16:18:32'),
(93, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTM5MjYsImV4cCI6MTc2MTEyMTEyNn0.Bj9RRPCwXHoXPU0Y6YVgm-VvhBFEHP19HBiPJF9rhJk', '2025-10-22 16:18:46'),
(94, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTM5NDAsImV4cCI6MTc2MTEyMTE0MH0.twOsUqrDc0jHWuzprir7PQVOVaW1W7NSxTnxEmZxxV0', '2025-10-22 16:19:00'),
(95, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMTM5NTIsImV4cCI6MTc2MTEyMTE1Mn0.-PnPd1zv0Z7uLnbueWFWVTs7BmlhDLzOgLmjrup5eNo', '2025-10-22 16:19:12'),
(96, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMTYzMDcsImV4cCI6MTc2MTEyMzUwN30.eg4wHJ-Htup9wLsTuW4o8QHixkuspAUK0K11ICTA9yY', '2025-10-22 16:58:27'),
(97, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMzk3MjYsImV4cCI6MTc2MTE0NjkyNn0.OH0x8EGakXvraLqMLacNsQpnvcGZmREeBwDp8SWlOBs', '2025-10-22 23:28:46'),
(98, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjExMzk3MzgsImV4cCI6MTc2MTE0NjkzOH0.1Sk7TZo4tBDE9sQ8BreYRNVj9hMLcEqzXYDsjoCqjZ4', '2025-10-22 23:28:58'),
(99, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExMzk3NTMsImV4cCI6MTc2MTE0Njk1M30.XwJIE5tcefSQl1CfrbU3baYZUOyhi2j4aM0uf9Zixu4', '2025-10-22 23:29:13'),
(100, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjExNDA3ODgsImV4cCI6MTc2MTE0Nzk4OH0.VuVBVMfLBlOWP3-vUtO0B9Q_-86mwshgEQvnUwZTib8', '2025-10-22 23:46:28'),
(101, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEyMDg1ODYsImV4cCI6MTc2MTIxNTc4Nn0.kBP5laO7tUsJWOJ3ypPaCs5QpchWAxulaw1ySPEryDs', '2025-10-23 18:36:26'),
(102, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEyMDg3MTYsImV4cCI6MTc2MTIxNTkxNn0.of-Qx9dHUXwWUmw_aOs9LuC1qL41_pCLFOAssRtDiJM', '2025-10-23 18:38:36'),
(103, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEyMjk0ODgsImV4cCI6MTc2MTIzNjY4OH0.UTI54eXqdVJyCc3TBzgsoQT0zM6lbHxzssnKxN1N2LY', '2025-10-24 00:24:48'),
(104, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjEyMjk1MTgsImV4cCI6MTc2MTIzNjcxOH0.p8LtsI--iyGzb14y9xtVMBSNjbgd-ilMuNnHochIi40', '2025-10-24 00:25:18'),
(105, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEzMDkxMTYsImV4cCI6MTc2MTMxNjMxNn0.8KRQf4jYu92SWgwvvOJTOhA4B7EC2poh9ZKTXNPv_Vo', '2025-10-24 22:31:56'),
(106, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEzMTIxMzksImV4cCI6MTc2MTMxOTMzOX0.GUHZNaFCM_NFyrgH95bUxIh4vzPi3GkJikIlhZmos4E', '2025-10-24 23:22:19'),
(107, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjEzMTUxNDYsImV4cCI6MTc2MTMyMjM0Nn0.HJnMg7BFarff28Ckc-raT5Ze-WjNKR5yTU6jAOBuv90', '2025-10-25 00:12:26'),
(108, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjEzMTUxNTksImV4cCI6MTc2MTMyMjM1OX0.b5MvWEjd2pYkzkD5HLLlEHTp26kxY35YA1DrQRiSUf8', '2025-10-25 00:12:39'),
(109, 3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjE3MjQ3MzcsImV4cCI6MTc2MTczMTkzN30.Gtx6mdCnjqBVMJYVx8lBY6eprXVlpy77a9TFsmlqx1s', '2025-10-29 17:58:57'),
(110, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3MjgyMTUsImV4cCI6MTc2MTczNTQxNX0.BEBMj4mzP4TgTj1Q1fuGRSrRgoJdoxpIUfeGaPA0PMQ', '2025-10-29 18:56:55'),
(111, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3MjkxNzMsImV4cCI6MTc2MTczNjM3M30.7E4IcVqVa9ZjCtCX-gQd881FunS99uTzX9Fugs4cQR0', '2025-10-29 19:12:53'),
(112, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3MzcxNTYsImV4cCI6MTc2MTc0NDM1Nn0.UqUZco5z-a3UeNvUN4z3PxgrLPKgaXEq9m6fPKhxyYE', '2025-10-29 21:25:56'),
(113, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3NDMzMjksImV4cCI6MTc2MTc1MDUyOX0.bXNE4ZNZeMcdMyuhCirbL1-dYHWu3Gt7HHbdPx2qE-0', '2025-10-29 23:08:49'),
(114, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3NDMzNzUsImV4cCI6MTc2MTc1MDU3NX0.6MlddJmuJ9s9Szxuq9roxyU7XTctuJZXQOL8h9Uyzss', '2025-10-29 23:09:35'),
(115, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3NDM0NDksImV4cCI6MTc2MTc1MDY0OX0.oKc4f_gsSq-UAULlTn_KeGsDVXxUvbenB4K7Dg30Pbk', '2025-10-29 23:10:49'),
(116, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE3OTEzNzEsImV4cCI6MTc2MTc5ODU3MX0.xmsoRvyVi-o1LWk_-9r4LksRlTh_kzmEgByHXxHQBOw', '2025-10-30 12:29:31'),
(117, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDU5ODgsImV4cCI6MTc2MTgxMzE4OH0.x2g5FpU4PMT9T4p7rUcmQoNqUBPQrklGj2LW-goUykI', '2025-10-30 16:33:08'),
(118, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDc0MDIsImV4cCI6MTc2MTgxNDYwMn0.LbXu5w1QhFmSGEb6q7voCj9sWKhgqFAaKJ-Zq9HNUCg', '2025-10-30 16:56:42'),
(119, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDc0MzMsImV4cCI6MTc2MTgxNDYzM30.k6uPJzdkJH9kvYXkjNN3gEtv9mq9w64qMsLtaz83WXU', '2025-10-30 16:57:13'),
(120, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDc0NjEsImV4cCI6MTc2MTgxNDY2MX0.-U0ng-HJkL-AVOGV8bKDraNqcpjM9WasMg8i2qrzIYw', '2025-10-30 16:57:41'),
(121, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDc1MzIsImV4cCI6MTc2MTgxNDczMn0.2gm1U8O_lnrt4pEZEBq0K0lIbCjBeZeBc9pQGRnn7KU', '2025-10-30 16:58:52'),
(122, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDc3MDAsImV4cCI6MTc2MTgxNDkwMH0._3EVAXJAqv99wFY6_lYkvHZWfsG5kzIExcENJgI9FPo', '2025-10-30 17:01:40'),
(123, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDc4MjYsImV4cCI6MTc2MTgxNTAyNn0.Hb_iD1VGI2ybWGRmUGwwxJHL6pabfADrdJZYMr-mWJw', '2025-10-30 17:03:46'),
(124, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDgwMjcsImV4cCI6MTc2MTgxNTIyN30.qnew2XsVbD0_wOj9rhTxIWkKPMlOI_jfhnVgoMezh7c', '2025-10-30 17:07:07'),
(125, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDgwNTcsImV4cCI6MTc2MTgxNTI1N30.kwP1Zm4_FQqMQT7t6AR_N3Z3_6YAkzMWJuLs50dOL7A', '2025-10-30 17:07:37'),
(126, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDgwNjMsImV4cCI6MTc2MTgxNTI2M30.kCvwt5kmMlyS3kgBXcwpFcSg7AwRj3Rb1uRdu8BprWc', '2025-10-30 17:07:43'),
(127, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDgwOTIsImV4cCI6MTc2MTgxNTI5Mn0.Kx8OkFGdiSMDPm9mqRvzQIzHXt7009uB0zWDD9ayTd4', '2025-10-30 17:08:12'),
(128, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4MDgzODIsImV4cCI6MTc2MTgxNTU4Mn0.S0pcPC--aReGcIk-ZcEuKey4325-ZOHW3KzxQgloIq8', '2025-10-30 17:13:02'),
(129, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE4OTU1MTQsImV4cCI6MTc2MTkwMjcxNH0.NYeSfhNMvYLhJntbmvD5Dhhzv0PLdOz9EssEPbJP9ow', '2025-10-31 17:25:14'),
(130, 4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjE5MDI3MjcsImV4cCI6MTc2MTkwOTkyN30.vxclKpZvCyrSSwp4h-PFRKx5zuZE5U3kbrAhIbb37Is', '2025-10-31 19:25:27');

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE `submissions` (
  `id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `classroom_id` int(11) NOT NULL,
  `file_url` text DEFAULT NULL,
  `sumbitted_at` timestamp NULL DEFAULT NULL,
  `feedback` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `ID` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `verification_code` varchar(6) DEFAULT NULL,
  `verification_expiry` datetime DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`ID`, `email`, `username`, `password`, `role`, `verification_code`, `verification_expiry`, `is_verified`) VALUES
(3, 'keithvirgenes17@gmail.com', 'Keith Justine A. Virgenes', '$2b$10$CToIc872O0BODciIYqrS1uSDIU0pG8/doQ0SXcBOvzPKKaOOMeyx.', 'student', NULL, NULL, 0),
(4, 'justineabdon71@gmail.com', '131fgh', '$2b$10$POctQm8T.wciahfiegozPuO88tQ/B.CLxmK3l2dSwX99dr1zIPjYa', 'teacher', NULL, NULL, 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `classrooms`
--
ALTER TABLE `classrooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `link` (`teacher_id`);

--
-- Indexes for table `classroom_members`
--
ALTER TABLE `classroom_members`
  ADD PRIMARY KEY (`id`),
  ADD KEY `link3` (`classroom_id`),
  ADD KEY `link4` (`student_id`);

--
-- Indexes for table `hidden_invites`
--
ALTER TABLE `hidden_invites`
  ADD PRIMARY KEY (`id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `invite_id` (`invite_id`);

--
-- Indexes for table `logging`
--
ALTER TABLE `logging`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FOREIGN KEY` (`user_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `quizzes`
--
ALTER TABLE `quizzes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_quizzes_classroom` (`classroom_id`);

--
-- Indexes for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_quiz_student_attempt` (`quiz_id`,`student_id`,`attempt_no`),
  ADD KEY `quiz_id` (`quiz_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `session`
--
ALTER TABLE `session`
  ADD PRIMARY KEY (`id`),
  ADD KEY `link-to-user's-table` (`user_id`);

--
-- Indexes for table `submissions`
--
ALTER TABLE `submissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `link2` (`student_id`),
  ADD KEY `FOREIGN KEY (classroom)` (`classroom_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`ID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `classrooms`
--
ALTER TABLE `classrooms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `classroom_members`
--
ALTER TABLE `classroom_members`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `hidden_invites`
--
ALTER TABLE `hidden_invites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `logging`
--
ALTER TABLE `logging`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `quizzes`
--
ALTER TABLE `quizzes`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `session`
--
ALTER TABLE `session`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=131;

--
-- AUTO_INCREMENT for table `submissions`
--
ALTER TABLE `submissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `classrooms`
--
ALTER TABLE `classrooms`
  ADD CONSTRAINT `link` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `classroom_members`
--
ALTER TABLE `classroom_members`
  ADD CONSTRAINT `link3` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`),
  ADD CONSTRAINT `link4` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`);

--
-- Constraints for table `hidden_invites`
--
ALTER TABLE `hidden_invites`
  ADD CONSTRAINT `hidden_invites_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`),
  ADD CONSTRAINT `hidden_invites_ibfk_2` FOREIGN KEY (`invite_id`) REFERENCES `classroom_members` (`id`);

--
-- Constraints for table `logging`
--
ALTER TABLE `logging`
  ADD CONSTRAINT `FOREIGN KEY` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`);

--
-- Constraints for table `quizzes`
--
ALTER TABLE `quizzes`
  ADD CONSTRAINT `fk_quizzes_classroom` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `session`
--
ALTER TABLE `session`
  ADD CONSTRAINT `link-to-user's-table` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `submissions`
--
ALTER TABLE `submissions`
  ADD CONSTRAINT `FOREIGN KEY (classroom)` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`),
  ADD CONSTRAINT `link2` FOREIGN KEY (`student_id`) REFERENCES `users` (`ID`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
