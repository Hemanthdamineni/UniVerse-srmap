import os

# Database path (relative to Scraper/ directory)
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend", "data", "career.sqlite"))

# Scraper Settings
SEARCH_TERMS = [
    "Software Engineer Intern",
    "Data Science Intern",
    "Full Stack Developer",
    "Frontend Engineer",
    "Backend Engineer",
    "Product Management Intern",
    "Cybersecurity Intern",
    "UI/UX Designer",
    "Mobile Developer Intern"
]

RESULTS_WANTED = 50
HOURS_OLD = 24
COUNTRY = "India"

# Schedule
RUN_INTERVAL_HOURS = 6

# Intelligence
TECH_SKILLS = {
    "python", "javascript", "typescript", "react", "node.js", "express",
    "machine learning", "deep learning", "data science", "sql", "mongodb",
    "aws", "docker", "kubernetes", "git", "java", "c++", "c", "rust",
    "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "flutter", "android", "ios", "swift", "kotlin", "django", "flask",
    "graphql", "rest api", "linux", "networking", "next.js", "tailwind",
    "firebase", "gcp", "azure", "jenkins", "terraform", "ansible",
    "solidity", "blockchain", "figma", "sketch", "adobe xd"
}

BRANCH_KEYWORDS = {
    "CSE": ["computer science", "cse", "it", "information technology", "software"],
    "ECE": ["electronics", "communication", "ece", "embedded", "vlsi"],
    "EEE": ["electrical", "eee", "power systems"],
    "ME": ["mechanical", "me", "robotics", "automation"],
    "CIVIL": ["civil", "construction", "structural"]
}
