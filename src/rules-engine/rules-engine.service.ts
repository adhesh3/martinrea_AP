import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ApprovalRule } from './entities/approval-rule.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

export interface ComputedApprovalChain {
  rule: { id: string; name: string };
  roleChain: Role[];
  userChain: string[];
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    @InjectModel(ApprovalRule)
    private readonly ruleModel: typeof ApprovalRule,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  /**
   * Compute the ordered approval chain for an invoice based on amount.
   *
   * Returns both the role chain (audit trail) and the resolved user chain
   * (used to populate invoice.approval_chain and invoice.current_approver_id).
   *
   * @throws when no matching rule exists for the amount
   * @throws when a required role cannot be resolved to a user
   *         (e.g. no Plant_Manager exists for the invoice's plant)
   */
  async computeApprovalChain(
    amount: number,
    plantId: string | null,
  ): Promise<ComputedApprovalChain> {
    const rule = await this.matchRule(amount);
    if (!rule) {
      throw new InternalServerErrorException(
        `No active approval rule matches amount ${amount}. ` +
          `Seed Rules_Engine via 'npm run seed:rules' or check PRD WF-03 defaults.`,
      );
    }

    const userChain: string[] = [];
    for (const role of rule.roleChain) {
      const user = await this.resolveApproverForRole(role, plantId);
      if (!user) {
        throw new InternalServerErrorException(
          `Routing rule '${rule.ruleName}' requires role '${role}' but no active user with that role ` +
            `${role === Role.PLANT_MANAGER ? `(plant=${plantId ?? 'N/A'}) ` : ''}exists.`,
        );
      }
      userChain.push(user.id);
    }

    this.logger.log(
      `Rule='${rule.ruleName}' amount=$${amount} roleChain=[${rule.roleChain.join(',')}] userChain=[${userChain.join(',')}]`,
    );

    return {
      rule: { id: rule.id, name: rule.ruleName },
      roleChain: rule.roleChain,
      userChain,
    };
  }

  /**
   * First-match rule selection. Order: priority ASC, then min_amount ASC.
   * A rule matches when:
   *   (min IS NULL OR amount >  min)
   * AND (max IS NULL OR amount <= max)
   *
   * Note the strict greater-than on min — tier boundaries are exclusive on
   * the lower edge so $10,000.00 falls into Tier 1, $10,000.01 into Tier 2.
   */
  private async matchRule(amount: number): Promise<ApprovalRule | null> {
    const rules = await this.ruleModel.findAll({
      where: { isActive: true },
      order: [
        ['priority', 'ASC'],
        ['minAmount', 'ASC'],
      ],
    });

    for (const r of rules) {
      const min = r.minAmount === null ? null : parseFloat(r.minAmount as unknown as string);
      const max = r.maxAmount === null ? null : parseFloat(r.maxAmount as unknown as string);
      const minOk = min === null || amount > min;
      const maxOk = max === null || amount <= max;
      if (minOk && maxOk) {
        return r;
      }
    }
    return null;
  }

  private async resolveApproverForRole(
    role: Role,
    plantId: string | null,
  ): Promise<User | null> {
    const where: Record<string, unknown> = { role, isActive: true };
    if (role === Role.PLANT_MANAGER) {
      where.plantId = plantId ?? { [Op.eq]: null };
    }
    return this.userModel.findOne({ where, order: [['createdAt', 'ASC']] });
  }
}
