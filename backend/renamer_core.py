import os
import re
import requests
from urllib.parse import quote
from pymongo import MongoClient

OMDB_API_KEY = "5a357ea1"  # Your OMDb API key
OMDB_BASE_URL = "http://www.omdbapi.com/"
VIDEO_EXTENSIONS = (".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv")

# --- MONGODB SETUP ---
# IMPORTANT: Replace with your MongoDB connection string
MONGO_URI = "mongodb://localhost:27017/"
client = MongoClient(MONGO_URI)
db = client["movie_renamer"]
movies_collection = db["movies"]

def get_video_files(root_dir):
    result = []
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if fname.lower().endswith(VIDEO_EXTENSIONS):
                full_path = os.path.join(dirpath, fname)
                result.append(full_path)
    return result

def generate_title_guesses(filename):
    name = os.path.splitext(filename)[0]
    year_match = re.search(r'\b(19|20)\d{2}\b', name)
    year = year_match.group() if year_match else None
    clean = re.sub(r'[\.\_\-]', ' ', name)
    clean = re.sub(r'\(.*?\)', '', clean)
    clean = re.sub(r'\[.*?\]', '', clean)
    clean = re.sub(r'\b(WEBRip|BluRay|WEB-DL|HDRip|x264|x265|HEVC|AAC|RBARG|DDP5\.1|YTS|EVO|MX|OneHack|Eng|Hindi|Dual Audio)\b', '', clean, flags=re.I)
    clean = re.sub(r'\b(19|20)\d{2}\b', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    guesses = [clean, clean + " movie", clean.split(' ')[0]]
    print(f"[LOG] Generated guesses for '{filename}': {guesses}")
    return guesses, year

def fetch_title_from_omdb(title_guesses, year=None):
    for guess in title_guesses:
        try:
            url = f"{OMDB_BASE_URL}?apikey={OMDB_API_KEY}&t={quote(guess)}"
            if year:
                url += f"&y={year}"
            print(f"[API] Fetching from OMDb: {url}")
            response = requests.get(url)
            data = response.json()
            if data.get("Response") == "True":
                title = data["Title"]
                print(f"[API] Found suggestion: '{title}' for guess '{guess}'")
                # Save to MongoDB if it's a new movie
                if movies_collection.find_one({"imdbID": data["imdbID"]}) is None:
                    movies_collection.insert_one(data)
                    print(f"[DB] Saved '{title}' to MongoDB.")
                return title
        except Exception as e:
            print(f"[ERROR] OMDb API failed for '{guess}': {e}")
    print(f"[API] No suggestion found for guesses: {title_guesses}")
    return None

def rename_files(files_to_rename):
    success = 0
    fail = 0
    logs = []
    for item in files_to_rename:
        old_path = item['filepath']
        new_name = item['newName']
        if new_name:
            ext = os.path.splitext(old_path)[1]
            new_path = os.path.join(os.path.dirname(old_path), new_name)
            if not new_path.endswith(ext):
                new_path += ext
            try:
                os.rename(old_path, new_path)
                log_msg = f"[✓] Renamed: {os.path.basename(old_path)} → {os.path.basename(new_path)}"
                print(log_msg)
                logs.append(log_msg)
                success += 1
            except Exception as e:
                log_msg = f"[✗] Failed: {os.path.basename(old_path)} | Reason: {str(e)}"
                print(log_msg)
                logs.append(log_msg)
                fail += 1
    return {"success": success, "fail": fail, "logs": logs}
