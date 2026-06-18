import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/** #28 POST /auth/signup — 이메일+비밀번호. 비번 최소 8자(DTO 거부 400). */
export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

/** #28 POST /auth/login — 자격은 형식보다 일치 여부가 핵심이라 password는 비어있지만 않으면 통과(불일치는 401). */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
