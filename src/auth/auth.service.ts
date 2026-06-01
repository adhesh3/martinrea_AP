import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuthProvider } from '../config/configuration';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    plantId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const provider = this.config.get<AuthProvider>('auth.provider') ?? 'local';
    if (provider !== 'local') {
      throw new ForbiddenException(
        'Local /auth/login is disabled when AUTH_PROVIDER=keycloak. ' +
          'Obtain a token from Keycloak: ' +
          `${this.config.get<string>('keycloak.issuer')}/protocol/openid-connect/token`,
      );
    }

    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await this.users.verifyPassword(password, user.passwordHash);
    if (!ok) {
      await this.audit.record({
        actionType: 'AUTH_LOGIN_FAILED',
        performedBy: user.id,
        newValue: { email: user.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      plantId: user.plantId,
      managerId: user.managerId,
    };

    const accessToken = await this.jwt.signAsync(payload);

    await this.audit.record({
      actionType: 'AUTH_LOGIN_SUCCESS',
      performedBy: user.id,
      newValue: { email: user.email, role: user.role },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        plantId: user.plantId,
      },
    };
  }
}
