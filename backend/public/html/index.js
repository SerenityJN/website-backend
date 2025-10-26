import React, { useState } from "react";
import axios from "axios";
import "./enrollment.css"; // Your existing CSS

const EnrollmentForm = () => {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    firstname: "", lastname: "", middlename: "", suffix: "", age: "", status: "",
    religion: "", nationality: "", birthdate: "", place_of_birth: "", sex: "",
    lot_blk: "", street: "", barangay: "", municipality: "", province: "", zipcode: "",
    email: "", phone: "", yearLevel: "", strand: "", student_status: "", password: "",
    guardian_name: "", relationship: "", guardian_phone: "", occupation: "",
  });

  const [files, setFiles] = useState({ birth_cert: null, form137: null, good_moral: null });
  const [successMsg, setSuccessMsg] = useState("");

  const steps = ["Welcome", "Account", "Student Info", "Education", "Family", "Upload Docs", "Review"];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    Object.keys(files).forEach(key => data.append(key, files[key]));

    try {
      const res = await axios.post("/api/students/register", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccessMsg(res.data.message);
    } catch (err) {
      console.error(err.response?.data || err);
      alert(err.response?.data?.message || "Registration failed");
    }
  };

  if (successMsg) {
    return (
      <div className="success">
        <h2>✅ Registration Complete</h2>
        <p>{successMsg}</p>
        <button onClick={() => window.location.reload()}>Register Again</button>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h1>Student Registration</h1>

      {/* Stepper */}
      <div className="stepper">
        {steps.map((label, index) => (
          <div key={index} className={`step ${index === step ? "active" : index < step ? "completed" : ""}`}>
            <div className="icon">{index + 1}</div>
            <p>{label}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} encType="multipart/form-data">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="form-step">
            <h3>Welcome to the SVSHS Online Application!</h3>
            <p>Follow the steps to complete your registration.</p>
          </div>
        )}

        {/* Step 1: Account Info */}
        {step === 1 && (
          <div className="form-step">
            <label>Email *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            <label>Mobile Number *</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required />
            <label>Password *</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} required />
          </div>
        )}

        {/* Step 2: Student Info */}
        {step === 2 && (
          <div className="form-step">
            <label>First Name *</label>
            <input type="text" name="firstname" value={formData.firstname} onChange={handleChange} required />
            <label>Last Name *</label>
            <input type="text" name="lastname" value={formData.lastname} onChange={handleChange} required />
            <label>Middle Name</label>
            <input type="text" name="middlename" value={formData.middlename} onChange={handleChange} />
            <label>Suffix</label>
            <select name="suffix" value={formData.suffix} onChange={handleChange}>
              <option value="">--Select--</option>
              <option>JR</option><option>SR</option><option>I</option><option>II</option>
            </select>
            <label>Age *</label>
            <input type="number" name="age" value={formData.age} onChange={handleChange} required />
            <label>Status *</label>
            <input type="text" name="status" value={formData.status} onChange={handleChange} required />
            <label>Religion *</label>
            <input type="text" name="religion" value={formData.religion} onChange={handleChange} required />
            <label>Nationality *</label>
            <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} required />
            <label>Birthdate *</label>
            <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} required />
            <label>Place of Birth *</label>
            <input type="text" name="place_of_birth" value={formData.place_of_birth} onChange={handleChange} required />
            <label>Gender *</label>
            <select name="sex" value={formData.sex} onChange={handleChange} required>
              <option value="">Select</option><option>Male</option><option>Female</option>
            </select>
          </div>
        )}

        {/* Step 3: Address */}
        {step === 3 && (
          <div className="form-step">
            <label>Block / Lot / House No. *</label>
            <input type="text" name="lot_blk" value={formData.lot_blk} onChange={handleChange} required />
            <label>Street *</label>
            <input type="text" name="street" value={formData.street} onChange={handleChange} required />
            <label>Barangay *</label>
            <input type="text" name="barangay" value={formData.barangay} onChange={handleChange} required />
            <label>Municipality *</label>
            <input type="text" name="municipality" value={formData.municipality} onChange={handleChange} required />
            <label>Province *</label>
            <input type="text" name="province" value={formData.province} onChange={handleChange} required />
            <label>ZIP Code *</label>
            <input type="text" name="zipcode" value={formData.zipcode} onChange={handleChange} required />
          </div>
        )}

        {/* Step 4: Guardian */}
        {step === 4 && (
          <div className="form-step">
            <label>Guardian Name *</label>
            <input type="text" name="guardian_name" value={formData.guardian_name} onChange={handleChange} required />
            <label>Relationship *</label>
            <select name="relationship" value={formData.relationship} onChange={handleChange} required>
              <option value="">--Select--</option><option>Father</option><option>Mother</option><option>Legal Guardian</option>
            </select>
            <label>Contact Number *</label>
            <input type="tel" name="guardian_phone" value={formData.guardian_phone} onChange={handleChange} required />
            <label>Occupation *</label>
            <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} required />
          </div>
        )}

        {/* Step 5: Upload */}
        {step === 5 && (
          <div className="form-step">
            <label>Birth Certificate *</label>
            <input type="file" name="birth_cert" onChange={handleFileChange} required />
            <label>Form 137 *</label>
            <input type="file" name="form137" onChange={handleFileChange} required />
            <label>Good Moral *</label>
            <input type="file" name="good_moral" onChange={handleFileChange} required />
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="form-step">
            <h3>Review Your Information</h3>
            <pre>{JSON.stringify(formData, null, 2)}</pre>
          </div>
        )}

        {/* Buttons */}
        <div className="buttons">
          {step > 0 && <button type="button" onClick={prevStep}>Back</button>}
          {step < steps.length - 1 ? (
            <button type="button" onClick={nextStep}>Next</button>
          ) : (
            <button type="submit">Submit</button>
          )}
        </div>
      </form>
    </div>
  );
};

export default EnrollmentForm;
