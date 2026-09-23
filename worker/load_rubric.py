import os
import argparse
from pathlib import Path
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

# one rubric file per track: rubrics/<track>.txt
RUBRICS_DIR = Path(__file__).parent / "rubrics"
TRACKS = sorted(p.stem for p in RUBRICS_DIR.glob("*.txt"))


def load(track):
    body = (RUBRICS_DIR / f"{track}.txt").read_text(encoding="utf-8")
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # next version number for this track, starting at 0
            cur.execute(
                'SELECT COALESCE(MAX(version) + 1, 0) FROM "Rubric" WHERE track = %s',
                (track,),
            )
            version = cur.fetchone()[0]
            # turn off any currently-active rubric for this track
            cur.execute(
                'UPDATE "Rubric" SET active = false WHERE track = %s',
                (track,),
            )
            # insert this rubric as the active one
            cur.execute(
                """
                INSERT INTO "Rubric" (id, track, version, active, body, "createdAt")
                VALUES (gen_random_uuid()::text, %s, %s, true, %s, now())
                """,
                (track, version, body),
            )
        conn.commit()
    print(f"Loaded and activated {track} rubric v{version}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load a track's rubric and make it active.")
    parser.add_argument("track", choices=TRACKS)
    args = parser.parse_args()
    load(args.track)
