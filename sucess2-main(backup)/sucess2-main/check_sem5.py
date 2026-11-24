import os
import subprocess

env = os.environ.copy()
env['PGPASSWORD'] = 'password'

sql = "UPDATE student_roster SET status = 'ACTIVE' WHERE semester=5 AND section='A';"

subprocess.run([
    r'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    '-U', 'campusexam',
    '-d', 'campusexam_test',
    '-h', '127.0.0.1',
    '-c', sql
], env=env, check=True)
print("Restored Sem 5 Sec A to ACTIVE.")
