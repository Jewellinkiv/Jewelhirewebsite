# Legacy Course Inventory

Source: logged-in Bubble admin dashboard at `https://app.jewelhire.ai/app_admin?view=courses%20(Admin)`.

Status: first-pass inventory plus started deep lesson extraction. The admin dashboard confirms 20 published courses and 4 unpublished courses. Course-list metadata and the course editor structure are documented. `JewelLink Premium How to` has now been sampled at the module/lesson level; full per-course lesson/video/test-answer extraction still needs additional passes through individual course editors.

## Counts

- Published courses: 20
- Unpublished courses: 4
- Total legacy course records observed: 24

## Course Design In Bubble

Courses are managed from the admin Training Center and use a three-tab editor:

1. General information
2. Modules and lessons
3. Tests

### General Information Fields

Observed fields:

- Course title
- Category
- Duration
- Place
- Lead instructor(s)
- Published yes/no
- Rich text course description
- Cover image
- Badge image
- Course-level video upload
- Sort rank
- For Store Owners Only checkbox
- Premium course yes/no

### Modules And Lessons

Observed structure:

- A course can contain one or more modules.
- Modules appear as accordion rows.
- Module fields include module title plus Save Module and Delete actions.
- Expanded modules expose an Add another lesson action.
- The editor also exposes Add another module.
- In the sampled published course, `JewelLink Premium How to`, the visible module was `Business Owners`.
- In the sampled unpublished course, `Overview of The 4 Sales Traits`, the module editor showed a blank `Modul 1`/module-title slot, suggesting this draft is not fully configured.

Observed lesson editor fields:

- Lesson title.
- Skills Acquired multi-select/tag field.
- Rich text lesson description.
- Video thumbnail upload.
- Lesson video upload/file card.
- Download materials upload area.
- Save Changes, Cancel, and Delete this lesson actions.

Deep sample: `JewelLink Premium How to`

- Course fields verified in editor:
  - Category: `Jewelry Training`
  - Duration: `20`
  - Place: `Online`
  - Lead instructor: `JewelLink`
  - Published: `yes`
  - Sort rank: `14`
  - For Store Owners Only: checked
  - Premium course: `no`
  - Cover image URL observed: `https://164c017bfd88e00091977f26c7df07d5.cdn.bubble.io/cdn-cgi/image/w=256,h=165,f=auto,dpr=2,fit=contain/f1734967832228x711785342902387200/SMP2Png%20File.png`
  - Badge image URL observed: `https://164c017bfd88e00091977f26c7df07d5.cdn.bubble.io/cdn-cgi/image/w=96,h=96,f=auto,dpr=2,fit=contain/f1734967838488x340982466661087000/FAV%20ICONPng%20File.png`
  - Course-level video: no filename or URL visible in the General information upload area during this pass.
- Module count observed: 1
- Module: `Business Owners`
- Lessons observed:
  1. `Setting Up Your Store Profile`
  2. `JewelCert: Assessing Candidate Potential`
  3. `Posting a Job`
  4. `Managing Your Team with JewelLink`
  5. `Training Center: Building a Knowledgeable Team`
  6. `Leveraging Social Features and Reviews`

Deep lesson records sampled:

1. `Setting Up Your Store Profile`
   - Skills: `business`, `profile`
   - Lesson video filename: `business%20profile_1.mp4`
   - Thumbnail: upload slot visible, no thumbnail filename exposed.
   - Download materials: upload slot visible, no attached material exposed.
   - Description summary: creating a JewelLink store profile, presenting company values/benefits/jobs, using public profiles and QR codes, and inviting team collaborators.

2. `JewelCert: Assessing Candidate Potential`
   - Skills field value observed: `Skills 1` placeholder/default
   - Lesson video filename: `jewelcert.mp4`
   - Thumbnail: upload slot visible, no thumbnail filename exposed.
   - Download materials: upload slot visible, no attached material exposed.
   - Description summary: using JewelCert to assess candidates, send aptitude tests, interpret results, understand certifications, and use saved progress/badges in evaluation.

3. `Posting a Job`
   - Skills: `post a job`
   - Lesson video filename: `posting%20a%20job.mp4`
   - Thumbnail: upload slot visible, no thumbnail filename exposed.
   - Download materials: upload slot visible, no attached material exposed.
   - Description summary: creating detailed job postings, using filters/tracking tools for applications and resumes, and keeping evergreen job opportunities active.

4. `Managing Your Team with JewelLink`
   - Skills: `team`
   - Lesson video filename: `my%20team.mp4`
   - Thumbnail: upload slot visible, no thumbnail filename exposed.
   - Download materials: upload slot visible, no attached material exposed.
   - Description summary: inviting team members, assigning courses/tests, monitoring team progress, tracking performance/ranking, and supporting ongoing training.

5. `Training Center: Building a Knowledgeable Team`
   - Skills: `training`, `center`
   - Lesson video filename: `training%20center.mp4`
   - Thumbnail: upload slot visible, no thumbnail filename exposed.
   - Download materials: upload slot visible, no attached material exposed.
   - Description summary: demonstrating the Training Center as a course resource for product knowledge, recruiting, onboarding, new hires, experienced professionals, badges, progress, and manager insight.

6. `Leveraging Social Features and Reviews`
   - Skills: `social`, `network`
   - Lesson video filename: `social%20and%20reviews.mp4`
   - Thumbnail: upload slot visible, no thumbnail filename exposed.
   - Download materials: upload slot visible, no attached material exposed.
   - Description summary: using JewelLink social and review features to promote achievements, engage the community, improve employer reputation, encourage employee reviews, and interact through comments/likes.

### Tests

Observed structure:

- Courses can have a Final test.
- Final test stores a passing threshold as `answer X out of Y`.
- Test questions appear as rows/prompts under the Tests tab.
- There is an Add question action.

Sampled course test data:

- `JewelLink Premium How to`
  - Passing threshold: 3 out of 5
  - Question prompts observed:
    1. `What is the primary purpose of the JewelLink store profile feature?`
    2. `What does JewelCert help businesses achieve?`
    3. `How does the Training Center benefit employees?`
    4. `What feature of JewelLink is designed to promote the company’s workplace culture?`
    5. `What advantage does maintaining ongoing job postings provide?`
- `Overview of The 4 Sales Traits`
  - Passing threshold: 0 out of 0
  - No configured final-test questions visible in the sampled editor view.

## Published Courses

1. `JewelLink Premium How to`
   - Owner/instructor shown: JewelLink
   - Duration: 20 hours
   - Place: Online
   - Type: Standard
   - Cover image: `SMP2Png File.png`
   - Summary: introduces jewelry businesses to JewelLink tools for recruitment, onboarding, training, and employee engagement.

2. `Individual Account How To`
   - Owner/instructor shown: JewelLink
   - Duration: 20 hours
   - Place: Online
   - Type: Standard
   - Cover image: `SMP1Png File.png`
   - Summary: introduces JewelLink for job seekers and professionals in the jewelry industry.

3. `Building and Managing a High-Performance Sales Team`
   - Owner/instructor shown: JewelLink
   - Duration: 1 hour
   - Place: Online
   - Type: Standard
   - Cover image: `management.jpg`
   - Summary: recruiting, developing, and managing a high-performing sales team.

4. `The Art of Experience in Jewelry Sales`
   - Owner/instructor shown: JewelLink
   - Duration: 1 hour
   - Place: Online
   - Type: Standard
   - Cover image: `shutterstock_2400843241.jpg`
   - Summary: creating consistent, engaging customer experiences in jewelry sales.

5. `One Piece Rule`
   - Owner/instructor shown: JewelLink
   - Duration: 1 hour
   - Place: Online
   - Type: Standard
   - Cover image: `shutterstock_772456309.jpg`
   - Summary: jewelry customer interaction and presentation training.

6. `Adding Value in the Jewelry Industry`
   - Owner/instructor shown: JewelLink
   - Duration: 1 hour
   - Place: online
   - Type: Standard
   - Cover image: `shutterstock_2490342135.jpg`
   - Summary: creating exceptional customer experiences and adding value.

7. `First Impressions`
   - Owner/instructor shown: JewelLink
   - Duration: 1 hour
   - Place: Online
   - Type: Standard
   - Cover image: `shutterstock_692204281.jpg`
   - Summary: helping jewelry sales professionals create strong first impressions.

8. `Team Etiquette Essentials (Job Seeker)`
   - Owner/instructor shown: JewelLink
   - Duration: 0.5 hours
   - Place: Online
   - Type: Standard
   - Cover image: `shutterstock_2489916669.jpg`
   - Summary: store and team etiquette for jewelry sales associates.

9. `Mastering the Four C's: A Guide to Diamond Excellence`
   - Owner/instructor shown: JewelLink
   - Duration: 0.5 hours
   - Place: Online
   - Type: Standard
   - Cover image: `shutterstock_1766030882.jpg`
   - Summary: diamond knowledge and confidence for jewelry sales associates.

10. `Jewelry Business Model: Building Customer-Centric Success`
    - Owner/instructor shown: JewelLink
    - Duration: 0.5 hours
    - Place: Online
    - Type: Standard
    - Cover image: `shutterstock_2485923623.jpg`
    - Summary: customer relationships and the jewelry business model.

11. `Inventory Security in Retail Jewelry: Protecting Assets and Ensuring Safety`
    - Owner/instructor shown: JewelLink
    - Duration: 0.5 hours
    - Place: Online
    - Type: Standard
    - Cover image: `shutterstock_2123020886.jpg`
    - Summary: minimizing inventory risk and improving retail jewelry security.

12. `Mastering Key Performance Indicators (KPIs) in Jewelry Sales`
    - Owner/instructor shown: JewelLink
    - Duration: 1 hour
    - Place: Online
    - Type: Standard
    - Cover image: `shutterstock_2508942019.jpg`
    - Summary: sales KPIs for jewelry sales success.

13. `Effective Onboarding: Building Strong Foundations for Success`
    - Owner/instructor shown: JewelLink
    - Duration: 1 hour
    - Place: Online
    - Type: Standard
    - Cover image: `management.jpg`
    - Summary: onboarding new hires with clear expectations and foundations.

14. `Understanding Personality Traits for Effective Sales Teams`
    - Owner/instructor shown: JewelLink
    - Duration: 1 hour
    - Place: Online
    - Type: Standard
    - Cover image: `management.jpg`
    - Summary: Assertive, Recessive, Emotional, and Product-Based traits for sales teams.

15. `4 Personality Traits for Sales Success`
    - Owner/instructor shown: JewelLink
    - Duration: 1 hour
    - Place: Online
    - Type: Standard
    - Cover image: `management.jpg`
    - Summary: Recessive, Assertive, Product-Based, and Emotional traits and sales success.

16. `Jewelry Basics: Terminology, Metals, and Maintenance`
    - Owner/instructor shown: JewelLink
    - Duration: 1 hour
    - Place: Online
    - Type: Standard
    - Cover image: `shutterstock_2304033839.jpg`
    - Summary: foundational jewelry terminology, metal types, and common repairs.

17. `Building a Staffing Matrix for Jewelry Stores`
    - Owner/instructor shown: JewelLink
    - Duration: 0.5 hours
    - Place: Online
    - Type: Standard
    - Cover image: `management.jpg`
    - Summary: building a jewelry-store staffing matrix from store needs and service patterns.

18. `Introduction to JewelLink: Revolutionizing Recruitment and Team Development`
    - Owner/instructor shown: JewelLink
    - Duration: 0.5 hours
    - Place: Online
    - Type: Standard
    - Cover image: `SMP2Png File.png`
    - Summary: overview of JewelLink as a recruiting, onboarding, and development tool.

19. `Diamond Product Knowledge Book`
    - Owner/instructor shown: JewelLink
    - Duration: 2 hours
    - Place: Online
    - Type: Standard
    - Cover image: `shutterstock_2501691699.jpg`
    - Summary: diamond product knowledge basics.

20. `Becoming a Top-Tier Jewelry Sales Professional`
    - Owner/instructor shown: JewelLink
    - Duration: 0.5 hours
    - Place: Online
    - Type: Standard
    - Cover image: `AdobeStock_549433335.jpeg`
    - Summary: transforming sales associates into top-tier jewelry sales professionals.

## Unpublished Courses

1. `Overview of The 4 Sales Traits`
   - Owner/instructor shown: John Matthews / William Jones in editor
   - Duration: 6 hours
   - Place: Online
   - Type: Standard
   - Category observed in editor: Jewelry Training
   - Cover image: `woman-owning-small-business-for-optical-shop-2023-11-27-05-30-04-utc.jpg`
   - Course-level video filename observed: `Traits.m4v`
   - Summary: five-part course about Recessive, Product-Based, Assertive, and Emotional sales traits.
   - Module/test status observed: incomplete module slot; final test `0 out of 0`.

2. `Basic Etiquette`
   - Owner/instructor shown: John Matthews
   - Duration: 2 hours
   - Place: Online
   - Type: Standard
   - Cover image: `gift-for-the-favourite-2024-09-19-06-31-39-utc.jpg`
   - Summary: 17-part course about teamwork, procedure, and basic jewelry-store etiquette.

3. `Always be recruiting`
   - Owner/instructor shown: John Matthews
   - Duration: 1 hour
   - Place: Online
   - Type: Standard
   - Cover image: `Heights Store.JPG`
   - Summary: three-part course about ongoing recruiting and training.

4. `Mastering the 4C's of Diamond Value`
   - Owner/instructor shown: JewelLink
   - Duration: 1 hour
   - Place: Online
   - Type: Standard
   - Cover image: `Screen Shot 2024-08-13 at 1.35.09 PM.png`
   - Summary: diamond value and selling confidence using the 4Cs.

## Video / Media Extraction Notes

- Cover image CDN URLs are visible in the list DOM and file-upload help text.
- Course-level videos are represented by upload fields in the General information tab.
- The sampled unpublished sales-traits course exposes video filename `Traits.m4v`.
- The editor did not expose a reliable full CDN video URL for `Traits.m4v`; visible/hidden video tags returned stale or page-relative sources.
- `JewelLink Premium How to` lesson video cards expose filenames but not reliable full CDN URLs in the visible editor UI.
- A deeper pass should open each course editor and record course-level video filename plus any lesson-level video filename/URL. If visible UI still only exposes filenames, use Bubble data/API or browser network inspection to resolve stored file URLs.

## v2 Course Model Notes

- Treat courses as structured learning objects, separate from aptitude assessments.
- Preserve course publish status because unpublished courses may be drafts, old training, or intentionally hidden internal material.
- Use first-class module and lesson records instead of Bubble accordion state.
- Keep final tests separate from aptitude tests; course tests are completion checks tied to training, while aptitude tests are hiring/profile assessments.
- Store media assets as explicit records with file type, original filename, CDN URL if available, and usage context: cover, badge, course video, lesson video.
- Course completion reporting should track module progress, lesson completion, test score, pass/fail state, and certificate/credential issuance if needed.
- Add admin completeness indicators for lessons so missing thumbnails, placeholder skills, missing downloadable materials, and unresolved video URLs are easy to spot before publishing.
