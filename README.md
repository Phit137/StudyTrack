# StudyTrack

A lightweight web app that helps students organize assignments, track due dates, and never miss a deadline.

---

## Features

### Assignment Management
Add, edit, and delete assignments with a title, course name, due date, and optional notes. All changes sync instantly to the cloud.

### Completion Tracking
Mark assignments complete or incomplete with one click. Completed assignments are visually separated from active ones and can be filtered out of the list.

### Filtering & Sorting
Filter the assignment list by **All**, **Active**, or **Completed**. Sort by course name, due date, or completion status in ascending or descending order.

### Dashboard
The home page shows your next four upcoming assignments at a glance, plus all assignments grouped by course. Click any assignment to view details, edit, or delete it.

### Calendar View
A monthly calendar highlights every day that has an assignment due. Click a day to see a full list of assignments for that date, with options to complete, edit, or delete each one.

### Status Badges
Assignments are automatically color-coded based on urgency:
- **Overdue** — past the due date
- **Due Today / Due Tomorrow** — immediate attention needed
- **This Week** — due within 7 days
- **Upcoming** — more than a week away
- **Complete** — finished

### Authentication
Sign up and log in with email and password. Each user's assignments are private and stored under their own account. Protected pages redirect to the login screen if you are not signed in.

### Mobile Responsive
The layout adapts to smaller screens with a hamburger navigation menu and a tap-to-open detail modal for assignments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 |
| Logic | Vanilla JavaScript (ES Modules) |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Version Control | Git & GitHub |

---

## Project Structure

```
midterm/
├── index.html        # Dashboard (login/signup + upcoming assignments)
├── index.js          # Dashboard logic
├── assignments.html  # Full assignment list
├── assignments.js    # Assignment list logic
├── calendar.html     # Monthly calendar view
├── calendar.js       # Calendar logic
├── script.js         # Shared Firebase module (auth + Firestore helpers)
└── styles.css        # All styles
```

---

## Data Model

Each assignment is stored in Firestore at `users/{uid}/assignments/{assignmentId}` with the following fields:

| Field | Type | Description |
|---|---|---|
| `title` | string | Assignment name |
| `course` | string | Course or class name |
| `dueDate` | string | Due date in `YYYY-MM-DD` format |
| `notes` | string | Optional extra details |
| `completed` | boolean | Whether the assignment is done |
