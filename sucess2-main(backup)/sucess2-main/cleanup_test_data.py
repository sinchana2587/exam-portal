import os
import subprocess

env = os.environ.copy()
env['PGPASSWORD'] = 'password'

sql = """
DELETE FROM student_roster_history WHERE student_id IN (SELECT id FROM student_roster WHERE section IN ('Section C', 'C')) OR group_id IN (SELECT id FROM academic_group WHERE section IN ('C', 'Section C'));
DELETE FROM student_roster WHERE section IN ('Section C', 'C');
DELETE FROM academic_group WHERE section IN ('C', 'Section C');
"""

subprocess.run([
    r'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    '-U', 'campusexam',
    '-d', 'campusexam_test',
    '-h', '127.0.0.1',
    '-c', sql
], env=env, check=True)

print("Section C cleaned successfully.")
