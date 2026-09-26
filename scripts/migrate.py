import os
import subprocess
import sys
from dotenv import load_dotenv

load_dotenv(override=True)

def run_migration():
    token = os.getenv("SUPABASE_ACCESS_TOKEN")
    if not token:
        print("SUPABASE_ACCESS_TOKEN is not set in environment or .env.")
        print("You can execute migrations/001_phase6_live_opportunities.sql in the Supabase Dashboard SQL Editor.")
        return False
    
    project_ref = "wkvzgimddzmuxsbskuxa"
    sql_file = os.path.join(os.path.dirname(__file__), "..", "migrations", "001_phase6_live_opportunities.sql")
    
    print(f"Running migration against project {project_ref}...")
    env = os.environ.copy()
    env["SUPABASE_ACCESS_TOKEN"] = token
    
    cmd = [
        "npx", "--yes", "supabase", "db", "query",
        "--linked",
        "--project-ref", project_ref,
        "-f", sql_file
    ]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.returncode == 0:
        print("Migration executed successfully!")
        print(res.stdout)
        return True
    else:
        print("Migration failed:")
        print(res.stderr or res.stdout)
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
