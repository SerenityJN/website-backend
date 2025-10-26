import React, { useEffect, useRef, useState } from "react";
import "../css/index.css";

export default function EnrollmentForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { STD_ID, message }
  const formRef = useRef(null);
  const applyBtnRef = useRef(null);
  const formSectionRef = useRef(null);
  const navHomeRef = useRef(null);
  const navAppRef = useRef(null);

  const TOTAL_STEPS = 1 + 6; // welcome + 6 .form-step

  /* ---------- NAV + SCROLL BEHAVIORS ---------- */
  useEffect(() => {
    const formSection = formSectionRef.current;
    const homeLink = navHomeRef.current;
    const appLink = navAppRef.current;

    function updateActiveNav() {
      if (!formSection || !homeLink || !appLink) return;
      const scrollPos = window.scrollY;
      const formTop = formSection.offsetTop - 200;
      if (scrollPos >= formTop) {
        homeLink.classList.remove("active");
        appLink.classList.add("active");
      } else {
        appLink.classList.remove("active");
        homeLink.classList.add("active");
      }
    }

    function revealOnScroll() {
      if (!formSection) return;
      const sectionTop = formSection.getBoundingClientRect().top;
      const triggerPoint = window.innerHeight - 150;
      if (sectionTop < triggerPoint) {
        formSection.classList.add("visible");
      }
    }

    window.addEventListener("scroll", updateActiveNav);
    window.addEventListener("scroll", revealOnScroll);

    updateActiveNav();
    revealOnScroll();

    return () => {
      window.removeEventListener("scroll", updateActiveNav);
      window.removeEventListener("scroll", revealOnScroll);
    };
  }, []);

  useEffect(() => {
    const btn = applyBtnRef.current;
    const formSection = formSectionRef.current;
    if (!btn || !formSection) return;

    const onApplyClick = (e) => {
      e.preventDefault();
      btn.classList.add("clicked");
      setTimeout(() => {
        formSection.scrollIntoView({ behavior: "smooth" });
        btn.classList.remove("clicked");
        if (navHomeRef.current) navHomeRef.current.classList.remove("active");
        if (navAppRef.current) navAppRef.current.classList.add("active");
      }, 500);
    };

    btn.addEventListener("click", onApplyClick);
    return () => btn.removeEventListener("click", onApplyClick);
  }, []);

  /* ---------- STEP DISPLAY / STEPPER ---------- */
  useEffect(() => {
    const stepEls = Array.from(document.querySelectorAll(".step"));
    const formSteps = Array.from(document.querySelectorAll(".form-step"));

    stepEls.forEach((el, i) => {
      el.classList.remove("active", "completed", "pending");
      if (i < currentStep) el.classList.add("completed");
      else if (i === currentStep) el.classList.add("active");
      else el.classList.add("pending");
    });

    formSteps.forEach((fs) => {
      fs.classList.remove("active");
      fs.style.display = "none";
    });

    const currentFs = formSteps[currentStep];
    if (currentFs) {
      currentFs.classList.add("active");
      currentFs.style.display = "block";
    }

    // If entering review step, populate review fields
    if (currentStep === TOTAL_STEPS - 1) {
      populateReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /* ---------- MODAL ---------- */
  function showModal() {
    setIsModalVisible(true);
    document.body.style.overflow = "hidden";
  }
  function hideModal() {
    setIsModalVisible(false);
    document.body.style.overflow = "";
  }
  function onModalProceed() {
    hideModal();
    setCurrentStep((s) => s + 1);
  }

  /* ---------- NAV BUTTONS ---------- */
  function handleNextClick(e) {
    e.preventDefault();
    if (submitting) return;

    // If currently on welcome -> show privacy modal
    if (currentStep === 0) {
      showModal();
      return;
    }

    // Validate visible inputs in this step
    const visibleFs = document.querySelectorAll(".form-step")[currentStep];
    if (visibleFs) {
      const inputs = visibleFs.querySelectorAll("input, select, textarea");
      for (let input of inputs) {
        if (!input.checkValidity()) {
          input.reportValidity();
          return;
        }
      }
    }

    // If last step (review) -> submit
    if (currentStep >= TOTAL_STEPS - 1) {
      handleSubmit();
      return;
    }

    setCurrentStep((s) => s + 1);
  }

  function handlePrevClick(e) {
    e.preventDefault();
    if (submitting) return;
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  /* ---------- POPULATE REVIEW ---------- */
  function populateReview() {
    const q = (name) => formRef.current?.querySelector(`[name='${name}']`);
    const getFile = (name) => q(name)?.files?.[0]?.name || "Not uploaded";
    const safeSet = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value ?? "";
    };

    safeSet("rev_email", q("email")?.value ?? "");
    safeSet("rev_phone", q("phone")?.value ?? "");
    safeSet(
      "rev_name",
      `${q("firstname")?.value ?? ""} ${q("middlename")?.value ?? ""} ${q("lastname")?.value ?? ""} ${q("suffix")?.value ?? ""}`
        .replace(/\s+/g, " ")
        .trim()
    );
    safeSet("rev_age", q("age")?.value ?? "");
    safeSet("rev_sex", q("sex")?.value ?? "");
    safeSet("rev_birthdate", q("birthdate")?.value ?? "");
    safeSet("rev_place_of_birth", q("place_of_birth")?.value ?? "");
    safeSet("rev_religion", q("religion")?.value ?? "");
    safeSet("rev_nationality", q("nationality")?.value ?? "");
    safeSet(
      "rev_address",
      `${q("lot_blk")?.value ?? ""}, ${q("street")?.value ?? ""}, ${q("barangay")?.value ?? ""}, ${q("municipality")?.value ?? ""}, ${q("province")?.value ?? ""} ${q(
        "zipcode"
      )?.value ?? ""}`
    );
    safeSet("rev_last_school", q("last_school")?.value ?? "");
    safeSet("rev_student_status", q("student_status")?.value ?? "");
    safeSet("rev_strand", q("strand")?.value ?? "");
    safeSet("rev_guardian_name", q("guardian_name")?.value ?? "");
    safeSet("rev_relationship", q("relationship")?.value ?? "");
    safeSet("rev_guardian_phone", q("guardian_phone")?.value ?? "");
    safeSet("rev_occupation", q("occupation")?.value ?? "");
    safeSet("rev_birth_cert", getFile("birth_cert"));
    safeSet("rev_form137", getFile("form137"));
    safeSet("rev_good_moral", getFile("good_moral"));
  }

  /* ---------- SUBMIT: send FormData to backend ---------- */
  async function handleSubmit() {
    if (!formRef.current || submitting) return;

    setSubmitting(true);

    try {
      const formEl = formRef.current;
      const formData = new FormData();

      const fields = [
        "email",
        "phone",
        "password",
        "firstname",
        "lastname",
        "middlename",
        "suffix",
        "age",
        "sex",
        "status",
        "nationality",
        "birthdate",
        "place_of_birth",
        "religion",
        "lot_blk",
        "street",
        "barangay",
        "municipality",
        "province",
        "zipcode",
        "last_school",
        "student_status",
        "yearLevel",
        "strand",
        "guardian_name",
        "relationship",
        "guardian_phone",
        "occupation",
      ];
      fields.forEach((name) => {
        const el = formEl.querySelector(`[name="${name}"]`);
        formData.append(name, el ? el.value ?? "" : "");
      });

      const fileNames = ["birth_cert", "form137", "good_moral"];
      fileNames.forEach((fname) => {
        const input = formEl.querySelector(`[name="${fname}"]`);
        if (input && input.files && input.files[0]) formData.append(fname, input.files[0]);
      });

      const res = await fetch("http://localhost:5000/api/enroll", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Server error");
      }

      setSuccess({ STD_ID: result.STD_ID, message: result.message || "Registered successfully" });
      setSubmitting(false);

      // optional: move to success view (you already show success when success state exists)
      // scroll success into view
      setTimeout(() => {
        document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submission failed: " + (err.message || "Unknown error"));
      setSubmitting(false);
    }
  }

  function handleRegisterAgain() {
    setSuccess(null);
    setCurrentStep(0);
    formRef.current?.reset();
    // clear review spans
    const spans = document.querySelectorAll("#reviewStep span, #reviewStep p span");
    spans.forEach((s) => (s.textContent = ""));
  }

  return (
    <>
      {/* HEADER */}
      <header>
        <div className="logo-text">SVSHS Online Application</div>
        <nav>
          <ul>
            <li>
              <button
                ref={navHomeRef}
                className="active"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                Home
              </button>
            </li>
            <li>
              <button
                ref={navAppRef}
                onClick={() => document.querySelector("#apply")?.scrollIntoView({ behavior: "smooth" })}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                Application
              </button>
            </li>
          </ul>
        </nav>
      </header>

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>
            Welcome to <span>Southville 8B Senior High School</span>
          </h1>
          <p>SVSHS Senior High School Online Application Portal</p>
          <button
            ref={applyBtnRef}
            className="apply-now"
            style={{
              border: "none",
              padding: "12px 28px",
              borderRadius: 6,
              color: "#fff",
              background: "#2563eb",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Apply Now →
          </button>
        </div>
      </section>

      {/* FORM CONTAINER */}
      <section id="apply" className="form-section" ref={formSectionRef}>
        <div className="form-container">
          <h1>Student Registration</h1>
          <p className="subtitle">Complete the steps below to create your account and choose your strand.</p>
          <div className="button-status">
            <ul>
              <li><a href="#">New Enrollee</a></li>
            </ul>
            <ul>
              <li><a href="#">Transferee</a></li>
            </ul>
            <ul>
              <li><a href="#">Returnee</a></li>
            </ul>
          </div>


          {/* STEPPER */}
          <div className="stepper" aria-hidden={false}>
            <div className={`step ${currentStep === 0 ? "active" : currentStep > 0 ? "completed" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-hand-sparkles"></i>
              </div>
              <p>Welcome</p>
            </div>

            <div className={`step ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-user"></i>
              </div>
              <p>Application Account</p>
            </div>

            <div className={`step ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-id-card"></i>
              </div>
              <p>Application Profile</p>
            </div>

            <div className={`step ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-book"></i>
              </div>
              <p>Educational Profile</p>
            </div>

            <div className={`step ${currentStep === 4 ? "active" : currentStep > 4 ? "completed" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-users"></i>
              </div>
              <p>Family Profile</p>
            </div>

            <div className={`step ${currentStep === 5 ? "active" : currentStep > 5 ? "completed" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-upload"></i>
              </div>
              <p>Upload Requirements</p>
            </div>

            <div className={`step ${currentStep === 6 ? "active" : "pending"}`}>
              <div className="icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <p>Review</p>
            </div>
          </div>

          {/* WELCOME (index 0) */}
          <div className="form-step active">
            <div className="welcome-box">
              <h3>Welcome to the SVSHS Online Application for Admission!</h3>
              <p>To proceed with your application, please do the following:</p>
              <ol>
                <li>
                  Be ready to upload your 2" x 2" photo with white background and any of the following:
                  <ul>
                    <li>For Grade 12 graduates: Grade 12 report card</li>
                    <li>For graduates of Non-Formal Education: PEPT/ALS rating</li>
                    <li>For current Grade 12 students: Grade 11 report card</li>
                    <li>For college transferees: Transcript of records or Certification of grades</li> 
                    <li>For degree holders: Transcript of records</li>
                    <li>For cross-enrollees: Permit to cross-enroll</li>
                  </ul>
                </li>
                <li>Review all information you entered before clicking Submit.</li>
                <li>Make sure to COPY/TAKE A SCREENSHOT of your reference number. You’ll use this later.</li>
              </ol>
            </div>
          </div>

          <form id="regForm" ref={formRef} encType="multipart/form-data" onSubmit={(e) => e.preventDefault()}>
            {/* Step 1 */}
            <div className="form-step">
              <div className="form-group">
                <label>Email *</label>
                <input type="email" name="email" required />
              </div>
              <div className="form-group">
                <label>Mobile Number *</label>
                <input type="tel" name="phone" placeholder="09XXXXXXXXX" maxLength="11" required />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" name="password" minLength="8" required />
              </div>
            </div>

            {/* Step 2 */}
            <div className="form-step">
              <div className="form-grid">
                <h3 style={{ gridColumn: "1 / -1" }}>Student Information</h3>

                <div className="form-group"><label>First Name *</label><input type="text" name="firstname" required /></div>
                <div className="form-group"><label>Last Name *</label><input type="text" name="lastname" required /></div>
                <div className="form-group"><label>Middle Name *</label><input type="text" name="middlename" /></div>

                <div className="form-group">
                  <label>Suffix *</label>
                  <select name="suffix">
                    <option value="">-- Select Suffix --</option>
                    <option>JR</option>
                    <option>SR</option>
                    <option>I</option>
                    <option>II</option>
                    <option>III</option>
                    <option>IV</option>
                    <option>V</option>
                    <option>V1</option>
                    <option>VII</option>
                    <option>VIII</option>
                    <option>IX</option>
                    <option>X</option>
                  </select>
                </div>

                <div className="form-group"><label>Age *</label><input type="number" name="age" min="1" required /></div>
                <div className="form-group"><label>Status *</label><input type="text" name="status" required /></div>
                <div className="form-group"><label>Religion *</label><input type="text" name="religion" required /></div>
                <div className="form-group"><label>Nationality *</label><input type="text" name="nationality" required /></div>
                <div className="form-group"><label>Birthday *</label><input type="date" name="birthdate" required /></div>
                <div className="form-group"><label>Place of Birth *</label><input type="text" name="place_of_birth" required /></div>

                <div className="form-group">
                  <label>Gender *</label>
                  <select name="sex" required>
                    <option value="" disabled>Select</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>

                <h3 style={{ gridColumn: "1 / -1" }}>Address Information</h3>
                <div className="form-group"><label>Block / Lot / House No. *</label><input type="text" name="lot_blk" required /></div>
                <div className="form-group"><label>Street *</label><input type="text" name="street" required /></div>
                <div className="form-group"><label>Barangay *</label><input type="text" name="barangay" required /></div>
                <div className="form-group"><label>Municipality / City *</label><input type="text" name="municipality" required /></div>
                <div className="form-group"><label>Province *</label><input type="text" name="province" required /></div>
                <div className="form-group"><label>ZIP Code *</label><input type="text" name="zipcode" required /></div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="form-step">
              <div className="form-group"><label>Last School Attended *</label><input type="text" name="last_school" required /></div>

              <div className="form-group">
                <label>Student Status *</label>
                <select name="student_status" required>
                  <option value="">-- Select Status --</option>
                  <option>New Enrollee</option>
                  <option>Transferee</option>
                </select>
              </div>

              <div className="form-group">
                <label>Year Level *</label>
                <select name="yearLevel" required>
                  <option value="">-- Select Year Level --</option>
                  <option>G11</option>
                  <option>G12</option>
                </select>
              </div>

              <div className="form-group">
                <label>Preferred Strand *</label>
                <select name="strand" required>
                  <option value="">-- Select Strand --</option>
                  <option>TVL - Electrical Installation and Management (EIM)</option>
                  <option>TVL - Automotive Servicing (ATS)</option>
                  <option>ACAD - Humanities &amp; Social Sciences (HUMSS)</option>
                </select>
              </div>
            </div>

            {/* Step 4 */}
            <div className="form-step">
              <h3>Guardian Information</h3>
              <div className="form-group"><label>Guardian Name *</label><input type="text" name="guardian_name" required /></div>
              <div className="form-group">
                <label>Relationship *</label>
                <select name="relationship" required>
                  <option value="">-- Select Relationship --</option>
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Legal Guardian</option>
                </select>
              </div>
              <div className="form-group"><label>Contact Number *</label><input type="tel" name="guardian_phone" placeholder="09XXXXXXXXX"  maxLength="11" required /></div>
              <div className="form-group"><label>Occupation *</label><input type="text" name="occupation" required /></div>
            </div>

            {/* Step 5 */}
            <div className="form-step">
              <div className="form-group"><label>Birth Certificate (PDF or Image) *</label><input type="file" name="birth_cert" accept=".pdf, image/*" required /></div>
              <div className="form-group"><label>Form 137 (PDF or Image) *</label><input type="file" name="form137" accept=".pdf, image/*" required /></div>
              <div className="form-group"><label>Good Moral (PDF or Image) *</label><input type="file" name="good_moral" accept=".pdf, image/*" required /></div>
            </div>

            {/* Step 6 REVIEW */}
            <div className="form-step" id="reviewStep">
              <h3>Review Your Information</h3>
              <p>Double-check all the details below before submitting your registration.</p>
              <div className="review-section">
                <h4>Account Information</h4>
                <p><strong>Email:</strong> <span id="rev_email"></span></p>
                <p><strong>Mobile Number:</strong> <span id="rev_phone"></span></p>

                <h4>Personal Information</h4>
                <p><strong>Name:</strong> <span id="rev_name"></span></p>
                <p><strong>Age:</strong> <span id="rev_age"></span></p>
                <p><strong>Gender:</strong> <span id="rev_sex"></span></p>
                <p><strong>Birthday:</strong> <span id="rev_birthdate"></span></p>
                <p><strong>Place of Birth:</strong> <span id="rev_place_of_birth"></span></p>
                <p><strong>Address:</strong> <span id="rev_address"></span></p>
                <p><strong>Religion:</strong> <span id="rev_religion"></span></p>
                <p><strong>Nationality:</strong> <span id="rev_nationality"></span></p>

                <h4>Academic Information</h4>
                <p><strong>Last School Attended:</strong> <span id="rev_last_school"></span></p>
                <p><strong>Student Status:</strong> <span id="rev_student_status"></span></p>
                <p><strong>Preferred Strand:</strong> <span id="rev_strand"></span></p>

                <h4>Guardian Information</h4>
                <p><strong>Guardian Name:</strong> <span id="rev_guardian_name"></span></p>
                <p><strong>Relationship:</strong> <span id="rev_relationship"></span></p>
                <p><strong>Contact Number:</strong> <span id="rev_guardian_phone"></span></p>
                <p><strong>Occupation:</strong> <span id="rev_occupation"></span></p>

                <h4>Uploaded Documents</h4>
                <p><strong>Birth Certificate:</strong> <span id="rev_birth_cert"></span></p>
                <p><strong>Form 137:</strong> <span id="rev_form137"></span></p>
                <p><strong>Good Moral:</strong> <span id="rev_good_moral"></span></p>
              </div>
            </div>

            {/* Buttons */}
            <div className="buttons">
              <button type="button" id="prevBtn" onClick={handlePrevClick} disabled={submitting}>
                Back
              </button>
              <button type="button" id="nextBtn" onClick={handleNextClick} disabled={submitting}>
                {currentStep === TOTAL_STEPS - 1 ? (submitting ? "Submitting..." : "Submit") : "Next"}
              </button>
            </div>

            {/* Success message */}
            {success && (
              <div className="success" id="successMsg" style={{ display: "block", marginTop: 20 }}>
                <h2>✅ Registration Complete</h2>
                <p>{success.message}</p>
                <p><strong>Reference Number:</strong> {success.STD_ID}</p>
                <div style={{ marginTop: 12 }}>
                  <button type="button" onClick={handleRegisterAgain}>Register Again</button>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* PRIVACY MODAL */}
      <div id="privacyModal" className={`privacy-modal ${isModalVisible ? "show" : ""}`}>
        <div className="privacy-content">
          <div className="privacy-box">
            <h1>Data Privacy Notice and Consent Form</h1>
            <p><strong>Southville 8B Senior High School</strong> values and respects your right to privacy and ensures that all personal information you provide will be processed in accordance with the Data Privacy Act of 2012 (R.A. 10173).</p>

            <h2>1. Purpose of Data Collection</h2>
            <p>Your personal data will be collected, used, and stored for the following purposes:</p>
            <ul>
              <li>To evaluate your eligibility for admission and enrollment.</li>
              <li>To maintain accurate student records for administrative and academic purposes.</li>
              <li>To comply with reporting requirements to the Department of Education and other authorized agencies.</li>
              <li>To communicate school-related updates, events, and announcements.</li>
            </ul>

            <h2>2. Types of Personal Data Collected</h2>
            <p>The following information may be collected from you:</p>
            <ul>
              <li>Personal details (name, age, sex, nationality, religion, etc.)</li>
              <li>Contact information (email, address, phone number)</li>
              <li>Educational background (previous schools, grades, etc.)</li>
              <li>Documents (birth certificate, Form 137, good moral certificate)</li>
            </ul>

            <h2>3. Data Protection and Security</h2>
            <p>All information will be stored securely in the school’s student database and will only be accessed by authorized personnel. The school implements appropriate physical, technical, and organizational measures to safeguard your data from unauthorized access, disclosure, alteration, or destruction.</p>

            <h2>4. Data Retention and Sharing</h2>
            <p>Your personal data will be retained for as long as necessary for the fulfillment of the above-stated purposes or as required by law. Sharing of data will only occur with your consent or when mandated by regulatory authorities.</p>

            <div className="consent-section">
              <p>By clicking “Proceed to Admission Portal,” I hereby give my consent to <strong>Southville 8B Senior High School</strong> to collect, process, and store my personal data for legitimate school-related purposes. I confirm that I have read and understood this Data Privacy Notice.</p>
            </div>

            <div className="modal-buttons">
              <button className="proceed-btn" onClick={onModalProceed}>Proceed to Admission Portal</button>
              <button className="close-btn" onClick={hideModal}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
