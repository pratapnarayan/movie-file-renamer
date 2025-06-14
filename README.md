# 🎬 Movie File Renamer - Web UI

This application provides a web-based user interface to rename movie files based on suggestions fetched from the OMDb API. It also stores fetched movie metadata in a MongoDB database.

## Project Structure

- `backend/`: Contains the Flask server, core logic, and Python dependencies.
- `frontend/`: Contains the HTML, CSS, and JavaScript for the user interface.

## Setup and Installation

### 1. Backend Setup

First, navigate to the backend directory:
```bash
cd backend
```

Install the required Python packages:
```bash
pip install -r requirements.txt
```

### 2. MongoDB Configuration

This application uses MongoDB to store movie data.

- **Install MongoDB:** If you don't have it, [install MongoDB Community Edition](https://www.mongodb.com/try/download/community).
- **Configure Connection:** Open `backend/renamer_core.py` and replace the placeholder `MONGO_URI` with your actual MongoDB connection string.

  ```python
  # IMPORTANT: Replace with your MongoDB connection string
  MONGO_URI = "mongodb://localhost:27017/"
  ```

### 3. OMDb API Key

The application uses the OMDb API. An API key is already included in `backend/renamer_core.py`. You can replace it with your own if needed.

## How to Run

1.  **Start the Backend Server:**

    Run the Flask application from within the `backend` directory:
    ```bash
    python app.py
    ```
    The server will start on `http://127.0.0.1:5000`.

2.  **Open the Frontend:**

    Open your web browser and navigate to:
    [http://127.0.0.1:5000](http://127.0.0.1:5000)

    The application UI should load.

## How to Use

1.  Click the **Select Movie Folder** button. A system dialog will appear for you to choose a folder.
2.  The application will scan the folder for video files and fetch renaming suggestions.
3.  The file list will appear. You can edit the suggested names in the "New Name" column.
4.  Click the **Rename Selected Files** button to perform the renaming.
5.  Logs of the operation will be displayed at the bottom.
