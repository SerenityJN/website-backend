/* ============================
   STEPPER LOGIC
============================ */
const steps = document.querySelectorAll(".form-step");
const stepperSteps = document.querySelectorAll(".step");
const form = document.getElementById("regForm");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

let current = 0; // Start at Welcome step

/* ============================
   PRIVACY MODAL
============================ */
const privacyModal = document.getElementById("privacyModal");
const proceedPrivacy = document.querySelector(".proceed-btn");

function disableScroll() {
  document.body.style.overflow = "hidden";
}
function enableScroll() {
  document.body.style.overflow = "";
}

// Show modal (with fade)
function showPrivacyModal() {
  privacyModal.classList.add("show");
  disableScroll();
}

// Hide modal
function hidePrivacyModal() {
  privacyModal.classList.remove("show");
  enableScroll();
}

// Proceed button
proceedPrivacy.addEventListener("click", () => {
  hidePrivacyModal();
  moveToNextStep();
});

/* ============================
   STEPPER FUNCTIONS
============================ */
function updateStepper() {
  stepperSteps.forEach((s, i) => {
    s.classList.remove("active", "completed", "pending");
    if (i < current) s.classList.add("completed");
    else if (i === current) s.classList.add("active");
    else s.classList.add("pending");
  });
}

/* ============================
   NEXT BUTTON
============================ */
nextBtn.addEventListener("click", (e) => {
  e.preventDefault();

  // If on Welcome step, show Data Privacy modal first
  if (current === 0) {
    showPrivacyModal();
    return;
  }

  // Validate fields for next steps
  const currentInputs = steps[current].querySelectorAll("input, select");
  for (let input of currentInputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
  }

  moveToNextStep();
});

function moveToNextStep() {
  if (current < steps.length - 1) {
    steps[current].classList.remove("active");
    steps[current].style.display = "none";
    current++;
    steps[current].classList.add("active");
    steps[current].style.display = "block";
    updateStepper();

    if (current === steps.length - 1) {
      nextBtn.textContent = "Submit";
      fillReviewSection();
    } else {
      nextBtn.textContent = "Next";
    }
  } else {
    form.submit();
  }
}

/* ============================
   PREVIOUS BUTTON
============================ */
prevBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (current > 0) {
    steps[current].classList.remove("active");
    steps[current].style.display = "none";
    current--;
    steps[current].classList.add("active");
    steps[current].style.display = "block";
    nextBtn.textContent = "Next";
    updateStepper();
  }
});

/* ============================
   REVIEW FILLER
============================ */
function fillReviewSection() {
  const q = (name) => document.querySelector(`[name='${name}']`);
  const getFile = (name) => q(name).files[0]?.name || "Not uploaded";

  document.getElementById("rev_email").textContent = q("email").value;
  document.getElementById("rev_phone").textContent = q("phone").value;
  document.getElementById("rev_name").textContent =
    `${q("firstname").value} ${q("middlename").value} ${q("lastname").value} ${q("suffix").value || ""}`;
  document.getElementById("rev_age").textContent = q("age").value;
  document.getElementById("rev_sex").textContent = q("sex").value;
  document.getElementById("rev_birthdate").textContent = q("birthdate").value;
  document.getElementById("rev_place_of_birth").textContent = q("place_of_birth").value;
  document.getElementById("rev_religion").textContent = q("religion").value;
  document.getElementById("rev_nationality").textContent = q("nationality").value;
  document.getElementById("rev_address").textContent =
    `${q("lot_blk").value}, ${q("street").value}, ${q("barangay").value}, ${q("municipality").value}, ${q("province").value} ${q("zipcode").value}`;
  document.getElementById("rev_last_school").textContent = q("last_school").value;
  document.getElementById("rev_student_status").textContent = q("student_status").value;
  document.getElementById("rev_strand").textContent = q("strand").value;
  document.getElementById("rev_guardian_name").textContent = q("guardian_name").value;
  document.getElementById("rev_relationship").textContent = q("relationship").value;
  document.getElementById("rev_guardian_phone").textContent = q("guardian_phone").value;
  document.getElementById("rev_occupation").textContent = q("occupation").value;

  document.getElementById("rev_birth_cert").textContent = getFile("birth_cert");
  document.getElementById("rev_form137").textContent = getFile("form137");
  document.getElementById("rev_good_moral").textContent = getFile("good_moral");
}

/* ============================
   INITIALIZE FIRST STEP
============================ */
steps.forEach((s, i) => s.style.display = i === 0 ? "block" : "none");
updateStepper();



document.addEventListener("DOMContentLoaded", () => {
  const applyBtn = document.querySelector('.hero-content a');
  const formSection = document.querySelector('#apply');
  const navLinks = document.querySelectorAll('header nav ul li a');
  const homeLink = [...navLinks].find(l => l.textContent.trim().toLowerCase() === 'home');
  const appLink = [...navLinks].find(l => l.textContent.trim().toLowerCase() === 'application');

  // --- Apply Now Button Animation + Scroll ---
  applyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    applyBtn.classList.add('clicked');

    setTimeout(() => {
      formSection.scrollIntoView({ behavior: 'smooth' });
      applyBtn.classList.remove('clicked');

      // ✅ Activate Application link
      navLinks.forEach(l => l.classList.remove('active'));
      appLink.classList.add('active');
    }, 500);
  });

  // --- Navbar Click Scroll + Active State ---
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.textContent.trim().toLowerCase();

      if (targetId === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } 
      else if (targetId === 'application') {
        formSection.scrollIntoView({ behavior: 'smooth' });
      }

      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // --- Reveal Form on Scroll ---
  const revealOnScroll = () => {
    const sectionTop = formSection.getBoundingClientRect().top;
    const triggerPoint = window.innerHeight - 150;

    if (sectionTop < triggerPoint) {
      formSection.classList.add('visible');
    }
  };

  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll();

  // --- Navbar Active Change on Scroll ---
  const updateActiveNav = () => {
    const scrollPos = window.scrollY;
    const formTop = formSection.offsetTop - 200;

    if (scrollPos >= formTop) {
      navLinks.forEach(l => l.classList.remove('active'));
      appLink.classList.add('active');
    } else {
      navLinks.forEach(l => l.classList.remove('active'));
      homeLink.classList.add('active');
    }
  };

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav(); // run on page load
});
