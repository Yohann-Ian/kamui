import os
import json
import argparse
import psycopg
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

MODEL = "claude-haiku-4-5"
TRACKS = ["ai-ml", "b2b-content"]

client = Anthropic(api_key=ANTHROPIC_API_KEY)


def get_active_rubric(cur, track):
    cur.execute(
        'SELECT id, body FROM "Rubric" WHERE track = %s AND active = true',
        (track,),
    )
    row = cur.fetchone()
    if row is None:
        raise SystemExit(f"No active rubric for track {track}. Run load_rubric.py {track} first.")
    return row[0], row[1]


def get_ungraded_jobs(cur, track, rubric_id):
    # jobs on this track that have no judgment under the active rubric yet
    cur.execute(
        """
        SELECT j.id, j.title, j.company, j.description
        FROM "Job" j
        WHERE j.track = %s
          AND NOT EXISTS (
            SELECT 1 FROM "Judgment" jm
            WHERE jm."jobId" = j.id AND jm."rubricId" = %s
          )
        """,
        (track, rubric_id),
    )
    return cur.fetchall()


def judge_one(rubric_body, title, company, description):
    prompt = f"""{rubric_body}

Now grade this job.

COMPANY: {company}
TITLE: {title}
DESCRIPTION:
{description or "(no description available)"}

Return ONLY this JSON, nothing else:
{{"grade": "Fit | Possible | Improbable | Unfit", "score": 0-100, "reason": "one sentence, 25 words max", "key_gap": "the single biggest gap, or null"}}"""

    msg = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    # strip code fences if the model added them
    if text.startswith("```"):
        text = text.split("```")[1].replace("json", "", 1).strip()
    return json.loads(text)


def main(track):
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            rubric_id, rubric_body = get_active_rubric(cur, track)
            jobs = get_ungraded_jobs(cur, track, rubric_id)
            print(f"{len(jobs)} ungraded {track} jobs to judge.")

            for job_id, title, company, description in jobs:
                try:
                    result = judge_one(rubric_body, title, company, description)
                except Exception as e:
                    print(f"  SKIP {company} / {title}: {e}")
                    continue

                cur.execute(
                    """
                    INSERT INTO "Judgment"
                        (id, "jobId", "rubricId", grade, score, reason, "keyGap", "createdAt")
                    VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT ("jobId", "rubricId") DO NOTHING
                    """,
                    (
                        job_id,
                        rubric_id,
                        result.get("grade"),
                        int(result.get("score", 0)),
                        result.get("reason"),
                        result.get("key_gap"),
                    ),
                )
                conn.commit()
                print(f"  {result.get('grade'):11} {result.get('score'):3}  {company} / {title}")

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Grade ungraded jobs for one track.")
    parser.add_argument("track", choices=TRACKS)
    args = parser.parse_args()
    main(args.track)
