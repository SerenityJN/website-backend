const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.registerStudent = async (req, res) => {
  try {
    if (!req.files || !req.files['birth_cert'] || !req.files['form137'] || !req.files['good_moral']) {
      return res.status(400).json({ message: 'All required documents must be uploaded.' });
    }

    const STD_ID = 'STD' + Date.now();
    const {
      firstname, lastname, middlename, suffix, age, status, religion,
      nationality, birthdate, place_of_birth, sex, lot_blk, street,
      barangay, municipality, province, zipcode, email, phone, yearLevel,
      strand, student_status, password,
      guardian_name, relationship, guardian_phone, occupation
    } = req.body;

    const home_add = `${lot_blk}, ${street}, ${barangay}, ${municipality}, ${province}, ${zipcode}`;

    // Step 1: Duplicate email
    const [emailCheck] = await db.query(
      "SELECT STD_ID FROM student_details WHERE email = ?", [email]
    );
    if (emailCheck.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Step 2: Duplicate student
    const [dupCheck] = await db.query(
      "SELECT STD_ID FROM student_details WHERE firstname=? AND lastname=? AND birthdate=?",
      [firstname.toUpperCase(), lastname.toUpperCase(), birthdate]
    );
    if (dupCheck.length > 0) {
      return res.status(400).json({ message: 'Student already exists' });
    }

    // Step 3: Insert student
    await db.query(
      `INSERT INTO student_details 
      (STD_ID, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate, place_of_birth, religion, cpnumber, home_add, email, yearlevel, strand, student_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        STD_ID, firstname.toUpperCase(), lastname.toUpperCase(), middlename.toUpperCase(), suffix,
        age, sex, status, nationality, birthdate, place_of_birth, religion,
        phone, home_add, email, yearLevel, strand, student_status
      ]
    );

    // Step 4: Student account
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO student_accounts (STD_ID, password) VALUES (?, ?)", [STD_ID, hashedPassword]);

    // Step 5: Guardian
    await db.query(
      "INSERT INTO guardians (STD_ID, name, relationship, contact, occupation) VALUES (?, ?, ?, ?, ?)",
      [STD_ID, guardian_name.toUpperCase(), relationship, guardian_phone, occupation.toUpperCase()]
    );

    // Step 6: Documents
    const birth_cert = req.files['birth_cert'][0].path;
    const form137 = req.files['form137'][0].path;
    const good_moral = req.files['good_moral'][0].path;

    await db.query(
      "INSERT INTO student_documents (STD_ID, birth_cert, form137, good_moral) VALUES (?, ?, ?, ?)",
      [STD_ID, birth_cert, form137, good_moral]
    );

    res.status(201).json({ message: 'Registration successful', STD_ID });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
