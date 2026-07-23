# WorkLah Project Knowledge Guide

> Current-state technical reference for the WorkLah team  
> Last reviewed: 23 July 2026  
> Source of truth: the current working tree and the verified `c237_worklah` database

## 1. Purpose of This Guide

This guide explains how WorkLah works, why its main features were created, and how the work relates to the C237 CA2 requirements and Development Journal.

It is intended for:

- Team members preparing for the demonstration and presentation.
- Team members completing Sections A-D of the Development Journal.
- An AI assistant that needs accurate context about the current application.
- Future developers who need to maintain or extend the application.

This guide explains code by component, route and workflow. It does not repeat every source line. The actual code remains the final authority when this guide and the application differ.

### Evidence and ownership rule

The guide separates:

1. **Primary implementation ownership** - supported by code comments, Git history and the agreed contribution table.
2. **Integration and verification responsibility** - related work such as testing permissions, checking database results, connecting pages and explaining a complete workflow.
3. **Team-integrated enhancements** - later features whose individual author has not yet been confirmed.

This keeps the contribution gap reasonable without claiming that a member wrote code they did not create. Before submission, the team must confirm any item marked **owner to confirm**.

---

## 2. Project Overview

### 2.1 Application purpose

WorkLah is a job-discovery and application-management web application. Students can find suitable jobs, maintain a reusable profile and resume, save jobs, submit applications and follow their application history. Administrators manage job postings and review student applications.

### 2.2 Target users

- **Students:** search for work opportunities, save jobs and submit applications.
- **Administrators:** publish and maintain jobs, inspect applicants and update application statuses.
- **Unauthenticated visitors:** view the landing, registration and login pages only.

### 2.3 Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Server | Node.js and Express | Routes, middleware and server-side logic |
| Views | EJS | Generates role-aware HTML using server data |
| UI | Bootstrap and shared EJS styles | Responsive navigation, forms, cards and feedback |
| Database | MySQL with `mysql2` | Persistent users, jobs, applications and bookmarks |
| Authentication | `express-session` | Stores the logged-in user between requests |
| Feedback | `connect-flash` | Carries success/error messages across redirects |
| Uploads | Multer, `fs` and `path` | Validates and stores resumes and profile pictures |

### 2.4 Architecture

WorkLah currently follows the same simple Express/CommonJS style used in the SupermarketApp reference:

```text
Browser
   ↓ HTTP request
Express route in app.js
   ↓ authentication/role middleware
MySQL callback query or private-file operation
   ↓ result data
EJS page
   ↓
HTML response in the browser
```

Business logic, SQL and routes are currently kept in one `app.js` file. This is easy to follow for a student project, although it should be separated into route/controller modules if the application becomes larger.

### 2.5 Main user journeys

#### Student

```text
Register → Login → Jobs → Search/Filter/View
                         ├─ Save to Bookmarks
                         └─ Apply using Profile Resume
                                  ↓
                         My Applications
                         View / Delete Pending / Reapply after Rejection
```

#### Administrator

```text
Login → Admin page
      ├─ Jobs → Add / View / Edit / Delete
      └─ Applications → View applicant/resume → Update latest pending status
```

---

## 3. Access and Permission Matrix

| Feature | Logged out | Student | Admin |
|---|---:|---:|---:|
| Landing page | Yes | Yes | Yes |
| Register and login | Yes | Yes | Yes |
| Job list/details | No | Yes | Yes |
| Search/filter/sort jobs | No | Yes | Yes |
| Profile/resume/picture | No | Own profile | No |
| Save jobs/bookmarks | No | Yes | No |
| Apply for jobs | No | Yes | No |
| View applications | No | Own records | All records |
| Delete application | No | Own pending record | No |
| Update application status | No | No | Latest pending attempt |
| Add/edit/delete jobs | No | No | Yes |

The UI hides controls that do not match the role, but the important protection is also applied on the server. Hiding a button alone is not security because a user can manually type a route URL.

---

## 4. Project Files and Pages

### 4.1 Root files and runtime folders

| File/folder | Runtime role | Explanation |
|---|---|---|
| `app.js` | Required | Application entry point containing configuration, middleware, 29 routes, SQL callbacks, upload handling and server startup. |
| `package.json` | Required | Project metadata and direct dependencies. The main entry point is `app.js`. |
| `package-lock.json` | Generated but required | Locks exact dependency versions so team members install the same dependency tree. Do not edit it manually. |
| `.gitignore` | Development support | Prevents `node_modules`, student resumes and profile pictures from being committed. |
| `uploads/resumes/` | Runtime data | Private PDF files. It is not served by `express.static`; authorised routes download files. |
| `uploads/profile-pictures/` | Runtime data | Private JPG/PNG files accessed through a protected route. |
| `node_modules/` | Generated | Installed packages. Recreate with `npm install`; do not document or commit each dependency file. |
| `WorkLah_Fix_Guide.md` | Historical planning only | Earlier problem analysis. Some names, schema details and suggested routes are outdated, so it is not the current source of truth. |
| `WORKLAH_PROJECT_KNOWLEDGE.md` | Documentation | This current-state technical and journal guide. |

`app.js` enables a `public` static directory, but the current project has no tracked `public` folder. Shared styles are presently supplied by `views/partials/styles.ejs`.

### 4.2 EJS pages

| View | Audience and data | How the page works | Ownership evidence |
|---|---|---|---|
| `views/index.ejs` | Everyone; `user`, success messages | Landing page. Changes its greeting/actions when a session user exists. | Leonard: landing/view integration |
| `views/login.ejs` | Logged-out users; success/errors | Posts email and password to `/login`. Displays registration success or login errors. | Xanthus |
| `views/register.ejs` | Logged-out users; errors and previous form data | Collects username, email, password, address and contact; posts to `/register`. Public registration always creates a student account. | Xanthus |
| `views/admin.ejs` | Admin; session `user` | Admin landing page with account information and links to jobs/applications. | Xanthus, with shared UI integration |
| `views/profile.ejs` | Student; profile and file-availability flags | Shows read-only identity, editable address/contact, reusable resume and separate profile-picture upload. | Team-integrated enhancement - owner to confirm |
| `views/jobList.ejs` | Student/admin; jobs and filter state | Displays responsive job cards. Students see Apply/Save; admins see Add/Edit/Delete. Includes Jun Yi's GET search/filter/sort form. | Leonard display, Jun Yi finding tools, CRUD controls integrated from Bryan/Nissi/Jomond |
| `views/jobInfo.ejs` | Student/admin; selected job and bookmark state | Detailed job card. Students can apply or save/remove the job. | Leonard display; bookmark enhancement owner to confirm |
| `views/addJob.ejs` | Admin | Posts a new job to `/addjob`. Includes category dropdown and an `Others` custom field. | Bryan; UI integration shared |
| `views/editJob.ejs` | Admin; selected `job` | Pre-fills current values and posts changes to `/job/:id/edit`. Supports existing custom categories. | Nissi; UI integration shared |
| `views/applyJob.ejs` | Student; selected `job` | Confirmation page showing the job and saved profile resume. It no longer asks for a second upload. | Team-integrated application enhancement - owner to confirm |
| `views/applicationList.ejs` | Role-aware `applications` | Admins immediately see applicant cards and status controls. Students see their own attempt history and may delete pending attempts. | Leonard display; status/history integration shared |
| `views/applicationInfo.ejs` | Authorised student/admin; one application | Shows applicant/job/resume/status details, attempt number and latest-attempt badge. | Leonard display; attempt enhancement shared |
| `views/bookmarks.ejs` | Student; `savedJobs` | Shows saved job cards, availability, View/Apply and Remove Saved actions. | Team-integrated finding enhancement - owner to confirm |
| `views/partials/navbar.ejs` | Every page; `res.locals.user` | Shared role-aware navigation. Logged-out, student and admin menus differ. | Leonard view integration; Xanthus access-state support |
| `views/partials/styles.ejs` | Every page that includes it | Shared WorkLah blue/yellow theme, cards, forms, badges and profile-picture styling. | Team-integrated UI - each member verifies their feature page |

### 4.3 Shared EJS pattern

Pages include the same navigation and visual rules:

```ejs
<%- include('partials/styles.ejs') %>
...
<%- include('partials/navbar.ejs') %>
```

`<%- ... %>` renders the included HTML without escaping it. Normal database values are displayed with `<%= ... %>`, which escapes HTML and reduces cross-site scripting risk.

---

## 5. Verified Database Design

### 5.1 Relationships

```text
users (student) 1 ─── * applications * ─── 1 gigs
users (student) 1 ─── * bookmarks    * ─── 1 gigs
users (admin)   1 ─── * gigs through posted_by (logical relationship)
```

The live database confirms foreign keys from `applications` and `bookmarks` to users/gigs. `gigs.posted_by` stores the administrator ID, but no foreign-key constraint was verified for that column.

### 5.2 `users`

| Column | Meaning |
|---|---|
| `id` | Primary key and session user identifier |
| `username`, `email` | Unique account identity |
| `password` | Current SHA-1 password value |
| `address`, `contact` | Registration/profile information |
| `resume_filename` | Student's current reusable profile resume |
| `profile_picture_filename` | Current profile-picture file |
| `role` | `student` or `admin` |
| `created_at` | Account creation time |

### 5.3 `gigs`

| Column | Meaning |
|---|---|
| `id` | Job primary key |
| `title`, `company`, `description` | Main job information |
| `category`, `pay`, `location` | Search/display information |
| `deadline` | Informational closing date |
| `posted_by` | ID of the administrator who created it |
| `created_at` | Creation time |

The shared database still contains a legacy job `status` column, but the current application does not use it. A job becomes unavailable to students when at least one related application has status `accepted`.

### 5.4 `applications`

| Column | Meaning |
|---|---|
| `id` | Unique application attempt |
| `student_id`, `gig_id` | Applicant and selected job |
| `resume_filename` | Private copy of the resume submitted for this attempt |
| `status` | `pending`, `accepted` or `rejected` |
| `applied_at` | Submission time |

Multiple attempts are preserved. A student may submit another attempt only when their latest attempt was rejected. Pending or accepted latest attempts block reapplication. Older attempts remain read-only evidence.

Each attempt receives its own resume copy, so replacing a profile resume changes future applications without changing historical submissions.

### 5.5 `bookmarks`

| Column | Meaning |
|---|---|
| `id` | Bookmark primary key |
| `student_id`, `gig_id` | Student and saved job |
| `saved_at` | Time saved |

The `unique_student_bookmark` constraint prevents a student from saving the same job twice.

---

## 6. `app.js` Components

### 6.1 Imports and setup

- `express`: application and routes.
- `mysql2`: MySQL connection and callback queries.
- `express-session`: login session.
- `connect-flash`: one-request feedback after redirects.
- `multer`: multipart file uploads.
- `fs`: directory checks, copies and deletion.
- `path`: safe platform-independent file paths.

### 6.2 Upload handling

- Resumes: PDF MIME type, maximum 5 MB.
- Profile pictures: JPG/PNG MIME types, maximum 2 MB.
- Private directories are created automatically when the server starts.
- Upload-error middleware converts Multer errors into readable flash messages.

### 6.3 Express middleware

| Middleware | Responsibility |
|---|---|
| `express.static('public')` | Would expose public assets if that folder exists |
| `express.urlencoded(...)` | Reads standard HTML form fields into `req.body` |
| `session(...)` | Maintains login state for seven days |
| `flash()` | Enables success/error messages |
| `res.locals.user` middleware | Makes the current user available to every EJS partial |
| `checkAuthenticated` | Redirects logged-out users to `/login` |
| `checkAdmin` | Allows admins and redirects other users |
| `checkStudent` | Allows students and blocks admins |
| `checkJobAvailable` | Blocks applications after any accepted application fills a job |
| `checkCanApplyAgain` | Allows first attempt or retry after latest rejection only |

Example of server-side role protection:

```js
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Access denied');
    res.redirect('/joblist');
};
```

### 6.4 Complete route reference

There are 30 current routes.

| Method and route | Access/middleware | Main input and operation | Result | Primary ownership |
|---|---|---|---|---|
| `GET /` | Public | Reads session/flash state | Renders `index` | Leonard |
| `GET /register` | Public | Reads flash/form data | Renders `register` | Xanthus |
| `POST /register` | Public; validation | Form fields; `INSERT users` | Redirects to login | Xanthus |
| `GET /login` | Public | Reads flash messages | Renders `login` | Xanthus |
| `POST /login` | Public | Email/password; `SELECT users` | Creates session; admin → `/admin`, student → `/joblist` | Xanthus |
| `GET /admin` | Authenticated admin | Session user | Renders `admin` | Xanthus |
| `GET /dashboard` | Authenticated | Session role | Compatibility redirect: admin → `/admin`, student → `/joblist` | Xanthus/Leonard integration |
| `GET /profile` | Authenticated student | `SELECT users`; checks private files | Renders `profile` | Team enhancement; access integration with Xanthus |
| `POST /profile` | Authenticated student; resume upload | Address/contact/optional PDF; `SELECT` then `UPDATE users` | Replaces profile data/resume | Team enhancement - owner to confirm |
| `POST /profile/picture` | Authenticated student; image upload | JPG/PNG; `SELECT` then `UPDATE users` | Replaces old picture | Team enhancement - owner to confirm |
| `GET /profile-picture/:studentId` | Authenticated owner/admin | Student ID; `SELECT users`; private `sendFile` | Displays authorised picture | Team enhancement; access verification with Xanthus |
| `GET /profile/resume` | Authenticated student | Session ID; `SELECT users`; private file | Downloads profile resume | Team enhancement; access verification with Xanthus |
| `GET /logout` | Any session state | Destroys session | Redirects to login | Xanthus |
| `GET /applicationList` | Authenticated | Role-aware joined `SELECT` | Admin cards or student's own history | Leonard display; team application integration |
| `GET /bookmarks` | Authenticated student | Joined `SELECT bookmarks/gigs/applications` | Renders `bookmarks` | Team finding enhancement; Jun Yi/Leonard verification |
| `POST /bookmark/:jobId` | Authenticated student | Student/job IDs; `INSERT bookmarks` | Saves once and redirects safely | Team finding enhancement |
| `POST /bookmark/:jobId/delete` | Authenticated student | Student/job IDs; `DELETE bookmarks` | Removes own saved job | Team finding/removal enhancement |
| `GET /joblist` | Authenticated | Query parameters; dynamic `SELECT`, `LIKE`, filters and `ORDER BY` | Role-aware job cards | Jun Yi query; Leonard display |
| `GET /job/:id` | Authenticated | Job ID; `SELECT gigs` and bookmark state | Renders `jobInfo` or 404 | Leonard |
| `GET /job/:id/apply` | Authenticated student; availability/retry checks | Job/student IDs; checks profile resume and `SELECT gigs` | Renders `applyJob` | Team application enhancement |
| `POST /job/:id/apply` | Authenticated student; availability/retry checks | Copies profile resume; conditional `INSERT applications` | Creates a new attempt | Team enhancement; Bryan/Jomond/Xanthus integration checks |
| `GET /application/:id` | Authenticated owner/admin | Joined application `SELECT` plus attempt calculations | Renders `applicationInfo` | Leonard display; shared history logic |
| `GET /application/:id/resume` | Authenticated owner/admin | Application ID; `SELECT`; private `download` | Sends application resume | Team enhancement; access verification with Xanthus |
| `POST /application/:id/delete` | Authenticated student | Application/student IDs; `SELECT` pending then `DELETE` | Deletes own pending attempt and file | Team removal enhancement; Jomond verification |
| `POST /application/:id/status` | Authenticated admin | Status and ID; `SELECT latest`, then guarded `UPDATE` | Updates latest pending attempt only | Team application enhancement |
| `GET /addjob` | Authenticated admin | Flash state | Renders `addJob` | Bryan |
| `POST /addjob` | Authenticated admin | Job form; validation and `INSERT gigs` | Adds job and redirects | Bryan |
| `GET /job/:id/edit` | Authenticated admin | Job ID; `SELECT gigs` with formatted date | Renders pre-filled `editJob` | Nissi |
| `POST /job/:id/edit` | Authenticated admin | Job form; validation and `UPDATE gigs` | Updates selected job | Nissi |
| `POST /deletejob/:id` | Authenticated admin | Job ID; `DELETE gigs` | Deletes or reports FK restriction | Jomond |

### 6.5 Important workflows

#### Login and role redirect

```js
req.session.user = results[0];
if (req.session.user.role === 'admin') {
    res.redirect('/admin');
} else {
    res.redirect('/joblist');
}
```

The database result becomes the session identity. The redirect sends each role to its most useful starting page.

#### Search, filter and safe sorting

Jun Yi's route starts with `WHERE 1=1`, then adds conditions only when a query value exists:

```js
if (search) {
    sql = sql + ' AND title LIKE ?';
    values.push('%' + search + '%');
}
```

Values use placeholders. Sort-column names cannot use placeholders, so the code checks `sortBy` against an allowlist before joining it into SQL.

#### Adding a job

```js
INSERT INTO gigs
(title, company, description, category, pay,
 location, deadline, posted_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

The form values and current administrator ID are inserted using placeholders.

#### Editing a job

The GET route retrieves one job and formats `deadline` as `YYYY-MM-DD` for the HTML date input. The POST route updates only the selected `id`.

#### Deleting a job safely

Deletion uses POST and an EJS confirmation dialog. If applications reference a job, the foreign key blocks the delete and the route displays an explanation instead of removing application history.

#### Reusable profile resume

The student uploads one master resume on Profile. Applying copies that file to a new application-specific name before inserting the application. If the database insert fails, the new copy is removed.

#### Reapplication history

`checkCanApplyAgain` selects the latest attempt by descending ID. A rejected latest attempt permits another submission; pending or accepted blocks it. Attempt numbers and latest status are calculated when results are displayed.

#### Admin application status

The status route:

1. Accepts only `pending`, `accepted` or `rejected`.
2. Finds the selected attempt.
3. Finds the latest attempt for the same student and job.
4. Updates only when the selected attempt is both latest and currently pending.

This prevents editing historical outcomes.

---

## 7. How WorkLah Meets the Assignment Requirements

### 7.1 User Access and Identity

**Requirement:** distinguish authenticated and unauthenticated users and protect authorised features.

WorkLah stores the selected user in `req.session.user` after a successful database login. `checkAuthenticated` protects jobs, applications, profiles and bookmarks. `res.locals.user` lets the navbar display the correct state. Logout destroys the session.

Presentation evidence:

- Open `/joblist` while logged out and show the login redirect.
- Log in and show role-specific navigation.
- Explain why server middleware is more important than hiding buttons.

### 7.2 User Roles

**Requirement:** at least two roles with different responsibilities.

- Students manage their profile, saved jobs and their own applications.
- Administrators manage jobs and review all applications.
- `checkStudent` and `checkAdmin` enforce these differences.
- Application ownership checks prevent one student from reading another student's record or resume.

### 7.3 Resource Management

**Requirement:** create, view, update and delete a key resource where appropriate.

The main resource is a job (`gigs`):

- Create: Bryan's `POST /addjob`.
- Read: Leonard's job list and detail pages.
- Update: Nissi's `POST /job/:id/edit`.
- Delete: Jomond's `POST /deletejob/:id`.

Applications and bookmarks provide additional resource management with stricter ownership and status rules.

### 7.4 Finding Information

**Requirement:** help users locate information efficiently.

Jun Yi's job-list route supports:

- Partial title search using `LIKE`.
- Company and category filters.
- Three pay ranges.
- Sorting by company, category, pay, location or deadline.
- Retaining selected query values in the EJS form.
- A Clear link that removes all query parameters.

### 7.5 User Interface and Experience

WorkLah uses:

- One shared role-aware navbar.
- Responsive Bootstrap job/application cards.
- Consistent blue/yellow styles.
- Empty-state messages.
- Flash success and error alerts.
- Confirmation before destructive actions.
- Date formatting for Singapore readers.
- Conditional buttons so users see actions relevant to their role.
- Profile-picture initials when no image exists.

### 7.6 Suggested Enhancements

| Enhancement | Why it was introduced | User need/problem | Implementation | Main challenge |
|---|---|---|---|---|
| Reusable profile resume | Avoid repeated uploads | Students apply faster | Private master resume copied per application | Preserve old application evidence when profile resume changes |
| Protected file routes | Resumes contain personal data | Files must not be public | Owner/admin checks plus `res.download`/`sendFile` | Check both database ownership and physical file |
| Profile pictures | Make applicant cards easier to recognise | Admin reviews many applicants | Private upload, replacement cleanup and fallback initial | Keep image permissions and missing-file handling correct |
| Bookmarks | Let students shortlist opportunities | Search results may need later review | `bookmarks` table, unique constraint and save/remove routes | Keep bookmark state correct across list/detail pages |
| Accepted-job hiding | Prevent applications to filled positions | A filled role should no longer appear available | Accepted-application query and direct-route middleware | Admin still needs complete job/history access |
| Multiple attempts | Preserve history but allow retry | Rejected students may improve and reapply | Latest-attempt checks, separate rows/resumes and read-only history | Prevent retry while pending/accepted and limit admin edits |
| Card UI and shared partials | Improve readability and consistency | Tables were crowded on smaller screens | Bootstrap cards, common navbar/styles and role-aware actions | Preserve every existing route/form while redesigning |

All enhancement ownership remains **team-integrated - owner to confirm**. For balanced presentation preparation:

- Xanthus verifies access and protected-file rules.
- Jun Yi verifies bookmark/search interaction and combined filters.
- Bryan verifies creation inputs and application insertion.
- Nissi verifies pre-filled forms, category changes and record targeting.
- Jomond verifies delete restrictions, confirmations and history preservation.
- Leonard verifies display data, navigation, role-aware cards and full-page integration.

These are verification/explanation responsibilities, not unsupported claims of code authorship.

---

## 8. Development Journal Guidance

### 8.1 Section A - Team information

| Item | Current information |
|---|---|
| Application name | WorkLah |
| Team members | See contribution table below |
| Theme | Student job discovery and application management |
| Target users | Students seeking work and administrators managing jobs/applications |
| GitHub repository | `https://github.com/Leonard0429/FA---WorkLah` |
| Website URL | Team to provide if deployed |
| Test accounts | Team to provide; never put production passwords in this guide |
| Additional instructions | Upload test PDF/JPG/PNG files within the stated size limits |

### 8.2 Section B - Feature development records

Use one record per major feature and keep the order close to actual development.

#### Record 1: Registration, login and access control

- **Responsible:** Xanthus.
- **Purpose:** identify users and restrict student/admin features.
- **Initial approach:** MySQL account records, sessions and role middleware.
- **Challenges to discuss:** preserving form feedback, avoiding missing-session errors and redirecting roles correctly.
- **Improvement evidence:** role-aware redirects and middleware added to protected routes.
- **Learning:** UI visibility is not enough; authorization must run on the server.
- **Suggested snippet:** `checkAuthenticated` or the login role redirect.

#### Record 2: Job and application display

- **Responsible:** Leonard.
- **Purpose:** present database records clearly and connect list/detail navigation.
- **Initial approach:** EJS pages receiving MySQL query results.
- **Challenges to discuss:** replacing temporary arrays, matching database field names and role-aware actions.
- **Improvement evidence:** joined application results, responsive cards and shared partials.
- **Learning:** a view depends on the exact variable and column names passed by its route.

#### Record 3: Searching, filtering and sorting

- **Responsible:** Jun Yi.
- **Purpose:** reduce the time needed to find relevant jobs.
- **Initial approach:** build SQL conditions from optional GET query parameters.
- **Challenges to discuss:** combined filters, retaining values and safe dynamic sorting.
- **Improvement evidence:** placeholders plus a sort allowlist and dropdown data from distinct queries.
- **Learning:** SQL values and SQL identifiers require different safety handling.

#### Record 4: Adding jobs

- **Responsible:** Bryan.
- **Purpose:** let administrators publish opportunities.
- **Initial approach:** admin form followed by a MySQL `INSERT`.
- **Challenges to discuss:** required fields, current database names and recording `posted_by`.
- **Improvement evidence:** server validation and listed/custom category support.
- **Learning:** client `required` fields should still be checked by the server.

#### Record 5: Editing jobs

- **Responsible:** Nissi.
- **Purpose:** let administrators correct existing postings.
- **Initial approach:** GET selected job, pre-fill EJS, POST an `UPDATE`.
- **Challenges to discuss:** HTML date formatting, custom categories and updating only one ID.
- **Improvement evidence:** `DATE_FORMAT`, placeholders and `affectedRows` checks.
- **Learning:** an edit flow requires both a retrieval route and an update route.

#### Record 6: Deleting jobs

- **Responsible:** Jomond.
- **Purpose:** remove obsolete jobs safely.
- **Initial approach:** route parameter and MySQL `DELETE`.
- **Challenges to discuss:** accidental GET deletion and jobs referenced by applications.
- **Improvement evidence:** POST form, browser confirmation and foreign-key error message.
- **Learning:** database constraints protect history even when application code makes a mistake.

#### Record 7: Applications and status review

- **Responsible:** team-integrated enhancement - owner to confirm.
- **Related verification:** Bryan (creation), Jomond (removal), Xanthus (permissions), Leonard (display).
- **Purpose:** complete the student-to-admin application workflow.
- **Challenges:** private resumes, ownership, status validation and historical attempts.
- **Learning:** application state rules must be checked again on the server.

#### Record 8: Profiles, bookmarks and UI enhancements

- **Responsible:** team-integrated enhancement - owner to confirm.
- **Related verification:** Xanthus (profile access), Jun Yi (finding/bookmarks), Leonard (UI integration), and each CRUD owner on their own page.
- **Purpose:** reduce repeated work and make the application easier to use.
- **Challenges:** file replacement cleanup, bookmark uniqueness and preserving form actions during redesign.
- **Learning:** a meaningful enhancement should solve a user problem and include server/database behavior, not only visual changes.

For **AI prompts used**, each member must paste their real prompt or accurately summarise it. Do not invent prompts. For **how the AI response was improved**, describe the member's actual checking, adaptation, debugging and testing.

### 8.3 Section C - Balanced contribution summary

| Team member | Primary ownership | Routes/operations | Integration and verification evidence | Presentation focus |
|---|---|---|---|---|
| Liew Qi Xuan Xanthus (25030608) | Registration, login, sessions and access control | `/register`, `/login`, `/admin`; `INSERT`, `SELECT` | Verify middleware across profile, file, application and admin routes | Explain identity, sessions, roles and server-side authorization |
| Lee Jun Yi (25018957) | Searching, filtering and sorting | `/joblist`; `SELECT`, `WHERE`, `LIKE`, `ORDER BY` | Verify combined filters, retained query values, bookmark state and accepted-job filtering | Explain dynamic SQL and safe sort allowlist |
| Jomond Aw Yu Zun (25039140) | Removing jobs | `/deletejob/:id`; `DELETE` | Verify POST confirmation, foreign-key restrictions and pending-application deletion behavior | Explain safe deletion and history protection |
| Ee Yong Le Bryan (25024920) | Adding jobs | `/addjob`; `INSERT` | Verify field validation, categories, `posted_by` and application creation inputs | Explain form → server validation → database insertion |
| Leonard Kiu Yao Win (25039841) | Landing, job/application display and navigation | `/`, `/joblist`, `/job/:id`, `/applicationList`, `/application/:id`; joined `SELECT` | Verify EJS data passing, cards, shared partials and end-to-end page integration | Explain database results → role-aware EJS |
| Lee Chun En Nissi (25043848) | Editing jobs | `/job/:id/edit`; `SELECT`, `UPDATE` | Verify pre-filled values, dates, custom categories, validation and selected-record updates | Explain retrieve → pre-fill → update |

This allocation keeps each member's main feature distinct and gives each member a substantial integration/testing responsibility. The team should use commits, screenshots, meeting notes and personal explanations as evidence rather than measuring contribution only by line count.

### 8.4 Section D - Individual reflection guidance

Personal reflection must be written and confirmed by the named member. The points below are prompts, not completed personal claims.

#### Xanthus

- Feature contributed most: registration, login, sessions or access middleware.
- Confident explanation: how `req.session.user` and role middleware work.
- Challenge evidence: missing sessions, protected routes or role redirects.
- Possible learning: authentication and authorization are different.
- AI reflection: state what AI suggested and what was personally checked/changed.

#### Jun Yi

- Feature contributed most: job search, filters and sorting.
- Confident explanation: how query parameters become SQL conditions.
- Challenge evidence: combined filter values and safe sorting.
- Possible learning: placeholders prevent unsafe value concatenation.
- AI reflection: identify any generated query/UI idea and personal improvements.

#### Jomond

- Feature contributed most: job deletion.
- Confident explanation: POST deletion and route parameters.
- Challenge evidence: referenced jobs cannot be deleted.
- Possible learning: foreign keys preserve related information.
- AI reflection: explain how proposed delete code was tested or corrected.

#### Bryan

- Feature contributed most: add-job form and insertion.
- Confident explanation: request-body values and placeholder order.
- Challenge evidence: matching all form fields to the `gigs` table.
- Possible learning: validate on both browser and server.
- AI reflection: explain how generated form/SQL was simplified or adapted.

#### Leonard

- Feature contributed most: job/application display and shared navigation.
- Confident explanation: joined results passed into role-aware EJS cards.
- Challenge evidence: temporary arrays, inconsistent field names or duplicate pages.
- Possible learning: route data and EJS variable names must match.
- AI reflection: distinguish AI-assisted integration from personally verified behavior.

#### Nissi

- Feature contributed most: edit-job workflow.
- Confident explanation: GET pre-fill followed by POST update.
- Challenge evidence: formatting MySQL dates for an HTML date input.
- Possible learning: route IDs and placeholders ensure the correct row changes.
- AI reflection: explain which suggestions were tested and how the form was improved.

Every member must answer the journal's final confidence/declaration question honestly and in their own words.

---

## 9. Known Issues and Future Improvements

These are documentation findings, not changes made by this guide. Public registration has already been corrected to create student accounts only.

| Priority | Current issue | Why it matters | Recommended future change |
|---|---|---|---|
| Critical | Database credentials and session secret are hard-coded | Secrets may leak through source control | Use environment variables and rotate exposed values |
| High | Passwords use SHA-1 | SHA-1 is not suitable password hashing | Use `bcrypt`/`argon2` with per-password salts |
| High | Default in-memory session store | Sessions disappear on restart and do not scale | Use a persistent MySQL/Redis session store |
| Medium | File checks mainly trust MIME type | MIME values can be forged | Check file signatures, generate random filenames and consider malware scanning |
| Medium | Many callback errors use `throw` | A database error may stop the server | Centralise Express error handling and show safe responses |
| Medium | No CSRF protection | Logged-in POST actions could be forged | Add CSRF tokens to state-changing forms |
| Medium | `app.js` contains all responsibilities | Maintenance and merging become difficult | Gradually separate auth, jobs, applications, profiles and bookmarks routes |
| Medium | No automated test suite | Regressions depend on manual browser testing | Add route/integration tests and a real `npm test` script |
| Low | Static `public` middleware exists without a tracked folder | Configuration is currently unused/confusing | Add deliberate public assets or remove the unused middleware |

Do not paste real passwords, database credentials, session secrets, test-account passwords or private upload filenames into a report, AI prompt or screenshot.

---

## 10. Testing and Presentation Checklist

### Authentication and roles

- Logged-out users are redirected from protected routes.
- Admin login opens `/admin`; student login opens `/joblist`.
- Students cannot open admin CRUD/status routes.
- Admins cannot use student profile, bookmark or application-submission routes.

### Jobs and finding information

- Add, view, edit and delete work with the intended administrator.
- A referenced job is not deleted.
- Search supports partial titles.
- Company, category and pay filters combine correctly.
- Invalid sort values fall back to deadline.
- Accepted jobs remain visible to admins but disappear for students.

### Applications and files

- Applying requires an existing profile resume.
- A submitted application contains a separate resume copy.
- Students see only their own applications.
- Resume and profile-picture routes reject unrelated students.
- Pending attempts may be deleted.
- Rejected attempts remain as history and allow a new attempt.
- Pending/accepted latest attempts block reapplication.
- Admin can update only the latest pending attempt.

### UI

- Navbar states work when logged out, student and admin.
- Cards remain readable on desktop and mobile.
- Empty lists show useful messages.
- Flash messages appear after redirects.
- All form actions still point to their existing routes.

---

## 11. Rules for Team Members and AI Assistants

When using this file as AI context:

1. Treat current `app.js`, current EJS files and the live schema as more authoritative than the legacy fix guide.
2. Preserve Express/CommonJS, callback queries and the existing beginner-readable style unless the team approves a refactor.
3. Do not add duplicate routes.
4. Do not expose private uploads through `express.static`.
5. Enforce permissions in server middleware and ownership queries, not only in EJS.
6. Preserve application history and application-specific resume copies.
7. Attribute only verified primary ownership; label later work **owner to confirm**.
8. Never include secret values in generated documentation or code examples.
9. Explain the approach and trade-offs so the team can present the work without depending on AI.
