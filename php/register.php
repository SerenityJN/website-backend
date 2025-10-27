<?php
include '../../../backend/db_connect.php';

// Generate unique student ID
$STD_ID = 'STD' . time(); // e.g. STD1728612723

// --- STUDENT DETAILS ---
$firstname = strtoupper($_POST['firstname']);
$lastname = strtoupper($_POST['lastname']);
$middlename = strtoupper($_POST['middlename']);
$suffix = $_POST['suffix'];
$age = $_POST['age'];
$status = $_POST['status'];
$religion = $_POST['religion'];
$nationality = $_POST['nationality'];
$birthdate = $_POST['birthdate'];
$place_of_birth = $_POST['place_of_birth'];
$sex = $_POST['sex'];
$lot_blk = strtoupper($_POST['lot_blk']);
$street = strtoupper($_POST['street']);
$barangay = strtoupper($_POST['barangay']);
$municipality = strtoupper($_POST['municipality']);
$province = strtoupper($_POST['province']);
$zipcode = $_POST['zipcode'];
$email = $_POST['email'];
$cpnumber = $_POST['phone'];
$yearLevel = $_POST['yearLevel'];
$strand = $_POST['strand'];
$student_status = $_POST['student_status'];

// Combine address
$home_add = "$lot_blk, $street, $barangay, $municipality, $province, $zipcode";


// ✅ --- STEP 1: Check for duplicate email ---
$check_email = $conn->prepare("SELECT STD_ID FROM student_details WHERE email = ?");
$check_email->bind_param("s", $email);
$check_email->execute();
$result_email = $check_email->get_result();

if ($result_email->num_rows > 0) {
    echo "<script>alert('This email is already registered. Please use a different one.'); window.history.back();</script>";
    exit();
}


// ✅ --- STEP 2: Check for duplicate student (same name + birthdate) ---
$check_duplicate = $conn->prepare("
    SELECT STD_ID FROM student_details 
    WHERE firstname = ? AND lastname = ? AND birthdate = ?
");
$check_duplicate->bind_param("sss", $firstname, $lastname, $birthdate);
$check_duplicate->execute();
$result_dup = $check_duplicate->get_result();

if ($result_dup->num_rows > 0) {
    echo "<script>alert('This student already exists in our records. Please contact the registrar for assistance.'); window.history.back();</script>";
    exit();
}


// ✅ --- STEP 3: Insert new student details ---
$student_sql = "INSERT INTO student_details 
(STD_ID, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate, place_of_birth, religion, cpnumber, home_add, email, yearlevel, strand, student_status)
VALUES ('$STD_ID', '$firstname', '$lastname', '$middlename', '$suffix', '$age', '$sex', '$status', '$nationality', '$birthdate', '$place_of_birth', '$religion', '$cpnumber', '$home_add', '$email', '$yearLevel', '$strand', '$student_status')";


if ($conn->query($student_sql)) {

    // ✅ --- STUDENT ACCOUNT ---
    $password = $_POST['password'];
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    $account_sql = "INSERT INTO student_accounts (STD_ID, password)
                    VALUES ('$STD_ID', '$hashed_password')";
    $conn->query($account_sql);


    // ✅ --- GUARDIAN INFO ---
    $guardianName = strtoupper($_POST['guardian_name']);
    $relationship = $_POST['relationship'];
    $guardianPhone = $_POST['guardian_phone'];
    $occupation = strtoupper($_POST['occupation']);

    $guardian_sql = "INSERT INTO guardians (STD_ID, name, relationship, contact, occupation)
    VALUES ('$STD_ID', '$guardianName', '$relationship', '$guardianPhone', '$occupation')";
    $conn->query($guardian_sql);


    // ✅ --- DOCUMENTS UPLOAD ---
    $uploadDir = "../../backend/uploads/";
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

    $birth_cert = $uploadDir . basename($_FILES["birth_cert"]["name"]);
    $form137 = $uploadDir . basename($_FILES["form137"]["name"]);
    $good_moral = $uploadDir . basename($_FILES["good_moral"]["name"]);

    move_uploaded_file($_FILES["birth_cert"]["tmp_name"], $birth_cert);
    move_uploaded_file($_FILES["form137"]["tmp_name"], $form137);
    move_uploaded_file($_FILES["good_moral"]["tmp_name"], $good_moral);

    $doc_sql = "INSERT INTO student_documents (STD_ID, birth_cert, form137, good_moral)
    VALUES ('$STD_ID', '$birth_cert', '$form137', '$good_moral')";
    $conn->query($doc_sql);


    // ✅ --- SUCCESS ---
    echo "<script>alert('Registration Successful!'); window.location='../html/';</script>";

} else {
    echo "Error: " . $conn->error;
}

$conn->close();
?>
