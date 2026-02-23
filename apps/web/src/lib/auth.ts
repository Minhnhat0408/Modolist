import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@repo/database"; // Đảm bảo đường dẫn import đúng với Monorepo của bạn
import bcrypt from "bcryptjs";
import { z } from "zod";

// Schema validate đầu vào
const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // Bắt buộc dùng JWT khi có Credentials Provider
  secret: process.env.AUTH_SECRET, // Nhớ thêm biến này vào .env
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true, // Cho phép link Google vào account đã tạo bằng email/pass
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          // 1. Validate dữ liệu đầu vào
          const { email, password } =
            await signInSchema.parseAsync(credentials);

          // 2. Tìm user trong DB
          const user = await prisma.user.findUnique({
            where: { email },
          });

          // 3. Check password
          if (!user || !user.password) {
            // User không tồn tại hoặc đăng ký bằng Google (không có pass)
            return null;
          }

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (!passwordsMatch) return null;

          // 4. Trả về user (NextAuth sẽ lưu vào token)
          return user;
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    // Logic đẩy ID và Image vào Token
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.picture = user.image;
      }

      // Hỗ trợ update session client-side
      if (trigger === "update" && session) {
        return { ...token, ...session.user };
      }

      return token;
    },

    // Logic đẩy ID từ Token xuống Session (Client mới đọc được)
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
        session.user.image = token.picture as string; // Google trả về 'picture'
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
