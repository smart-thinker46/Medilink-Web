import sql from "@/app/api/utils/sql";
import jwt from "jsonwebtoken";
import { hashPassword } from "@/utils/password";

export async function POST(request) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      ...additionalData
    } = await request.json();

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return Response.json(
        {
          message:
            "Email, password, first name, last name, and role are required",
        },
        { status: 400 },
      );
    }

    // Validate role
    const validRoles = ["patient", "medic", "hospital_admin", "pharmacy"];
    if (!validRoles.includes(role)) {
      return Response.json(
        { message: "Invalid role specified" },
        { status: 400 },
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return Response.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUsers.length > 0) {
      return Response.json(
        { message: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Start transaction to create user and role-specific profile
    const result = await sql.transaction(async (txn) => {
      // Create user
      const [user] = await txn`
        INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
        VALUES (${email}, ${passwordHash}, ${firstName}, ${lastName}, ${role}, ${phone})
        RETURNING id, email, first_name, last_name, role, phone, created_at
      `;

      // Create role-specific profile
      let profileData = {};

      switch (role) {
        case "patient":
          const [patient] = await txn`
            INSERT INTO patients (
              user_id, 
              date_of_birth, 
              gender, 
              emergency_contact_name, 
              emergency_contact_phone
            )
            VALUES (
              ${user.id}, 
              ${additionalData.dateOfBirth || null}, 
              ${additionalData.gender || null}, 
              ${additionalData.emergencyContactName || null}, 
              ${additionalData.emergencyContactPhone || null}
            )
            RETURNING *
          `;
          profileData = patient;
          break;

        case "medic":
          if (!additionalData.licenseNumber || !additionalData.specialization) {
            throw new Error(
              "License number and specialization are required for medics",
            );
          }
          const [medic] = await txn`
            INSERT INTO medics (
              user_id, 
              license_number, 
              specialization, 
              experience_years,
              consultation_fee
            )
            VALUES (
              ${user.id}, 
              ${additionalData.licenseNumber}, 
              ${additionalData.specialization}, 
              ${additionalData.experienceYears || 0},
              ${additionalData.consultationFee || 0}
            )
            RETURNING *
          `;
          profileData = medic;
          break;

        case "hospital_admin":
          if (!additionalData.hospitalId) {
            throw new Error("Hospital ID is required for hospital admins");
          }
          const [admin] = await txn`
            INSERT INTO hospital_admins (user_id, hospital_id)
            VALUES (${user.id}, ${additionalData.hospitalId})
            RETURNING *
          `;
          profileData = admin;
          break;

        case "pharmacy":
          if (!additionalData.pharmacyName || !additionalData.licenseNumber) {
            throw new Error("Pharmacy name and license number are required");
          }
          const [pharmacy] = await txn`
            INSERT INTO pharmacies (
              user_id, 
              name, 
              license_number, 
              address, 
              phone, 
              email
            )
            VALUES (
              ${user.id}, 
              ${additionalData.pharmacyName}, 
              ${additionalData.licenseNumber}, 
              ${additionalData.address || null}, 
              ${additionalData.pharmacyPhone || phone}, 
              ${additionalData.pharmacyEmail || email}
            )
            RETURNING *
          `;
          profileData = pharmacy;
          break;
      }

      return { user, profileData };
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
      process.env.AUTH_SECRET || "fallback-secret",
      { expiresIn: "7d" },
    );

    // Return user data and token
    return Response.json({
      message: "User created successfully",
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        role: result.user.role,
        phone: result.user.phone,
        profile: result.profileData,
      },
      token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return Response.json(
      { message: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
