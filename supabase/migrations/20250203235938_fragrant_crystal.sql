/*
  # Initial Schema Setup

  1. New Tables
    - projects
      - id (uuid, primary key)
      - name (text)
      - created_at (timestamp)
      - user_id (uuid, foreign key)
    
    - broll_generations
      - id (uuid, primary key)
      - project_id (uuid, foreign key)
      - prompt (text)
      - model (text)
      - output_url (text)
      - status (text)
      - created_at (timestamp)
      - user_id (uuid, foreign key)
    
    - audio_generations
      - id (uuid, primary key)
      - project_id (uuid, foreign key)
      - text (text)
      - reference_audio_url (text)
      - model (text)
      - output_url (text)
      - status (text)
      - created_at (timestamp)
      - user_id (uuid, foreign key)
    
    - lipsync_generations
      - id (uuid, primary key)
      - project_id (uuid, foreign key)
      - video_url (text)
      - audio_url (text)
      - model (text)
      - output_url (text)
      - status (text)
      - created_at (timestamp)
      - user_id (uuid, foreign key)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Create broll_generations table
CREATE TABLE broll_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  prompt text NOT NULL,
  model text NOT NULL,
  output_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Create audio_generations table
CREATE TABLE audio_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  text text NOT NULL,
  reference_audio_url text,
  model text NOT NULL,
  output_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Create lipsync_generations table
CREATE TABLE lipsync_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  video_url text NOT NULL,
  audio_url text NOT NULL,
  model text NOT NULL,
  output_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE broll_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lipsync_generations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own broll generations"
  ON broll_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own broll generations"
  ON broll_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own audio generations"
  ON audio_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audio generations"
  ON audio_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own lipsync generations"
  ON lipsync_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lipsync generations"
  ON lipsync_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);