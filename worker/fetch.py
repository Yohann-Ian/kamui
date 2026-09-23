import os
import json
from apify_client import ApifyClient
import psycopg
from dotenv import load_dotenv

load_dotenv()

APIFY_TOKEN = os.environ["APIFY_TOKEN"]
DATABASE_URL = os.environ["DATABASE_URL"]

ACTOR_ID = "jharney/career-site-jobs-api"

# The same settings you tested in the Apify form
run_input = {
    "mode": "search",
    "titleIncludes": ["machine learning engineer", "AI engineer"],
    "location": "United States",
    "includeDescription": True,
    "maxBoards": 500,
    "maxJobs": 50,
    "maxJobsPerBoard": 10,
}

TRACK = "ai-ml"


def fetch_jobs():
    client = ApifyClient(APIFY_TOKEN)
    print("Starting actor run, this takes about a minute...")
    run = client.actor(ACTOR_ID).call(run_input=run_input)
    items = list(client.dataset(run.default_dataset_id).iterate_items())
    print(f"Actor returned {len(items)} jobs.")
    return items


def save_jobs(items):
    inserted = 0
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            for job in items:
                cur.execute(
                    """
                    INSERT INTO "Job"
                        (id, source, company, title, location, "locationBin", track, url, description, raw, "firstSeen")
                    VALUES
                        (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        str(job.get("jobId")),
                        job.get("ats"),
                        job.get("company"),
                        job.get("title"),
                        job.get("location"),
                        job.get("location"),
                        TRACK,
                        job.get("url"),
                        job.get("descriptionText"),
                        json.dumps(job),
                    ),
                )
                inserted += cur.rowcount
        conn.commit()
    print(f"Wrote {inserted} new jobs into the Job table.")


if __name__ == "__main__":
    jobs = fetch_jobs()
    save_jobs(jobs)