import sql from "@/app/api/utils/sql";
import jwt from "jsonwebtoken";
import { verifyPassword } from "@/utils/password";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validate required fields
    if (!email || !password) {
      return Response.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    // Find user by email
    const users = await sql`
      SELECT id, email, password_hash, first_name, last_name, role, phone, is_verified
      FROM users 
      WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      return Response.json(
        { message: "Invalid email or password" },
        { status: 401 },
      );
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(user.password_hash, password);
    if (!isValidPassword) {
      return Response.json(
        { message: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Get role-specific profile data
    let profileData = {};

    switch (user.role) {
      case "patient":
        const [patient] = await sql`
          SELECT * FROM patients WHERE user_id = ${user.id}
        `;
        profileData = patient || {};
        break;

      case "medic":
        const [medic] = await sql`
          SELECT m.*, h.name as hospital_name 
          FROM medics m
          LEFT JOIN hospitals h ON m.hospital_id = h.id
          WHERE m.user_id = ${user.id}
        `;
        profileData = medic || {};
        break;

      case "hospital_admin":
        const [admin] = await sql`
          SELECT ha.*, h.name as hospital_name, h.address as hospital_address
          FROM hospital_admins ha
          LEFT JOIN hospitals h ON ha.hospital_id = h.id
          WHERE ha.user_id = ${user.id}
        `;
        profileData = admin || {};
        break;

      case "pharmacy":
        const [pharmacy] = await sql`
          SELECT * FROM pharmacies WHERE user_id = ${user.id}
        `;
        profileData = pharmacy || {};
        break;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        hospitalId: profileData.hospital_id || null,
        pharmacyId: profileData.id || null,
      },
      process.env.AUTH_SECRET || "fallback-secret",
      { expiresIn: "7d" },
    );

    // Return user data and token (exclude password hash)
    return Response.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
        isVerified: user.is_verified,
        profile: profileData,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
