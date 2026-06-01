import { InternalServerErrorException } from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service';
import { Role } from '../common/enums/role.enum';

type Rule = {
  id: string;
  ruleName: string;
  minAmount: number | null;
  maxAmount: number | null;
  roleChain: Role[];
  priority: number;
  isActive: boolean;
};

function fakeRuleModel(rules: Rule[]) {
  return {
    findAll: jest
      .fn()
      .mockImplementation(async ({ where }: { where?: { isActive?: boolean } } = {}) => {
        if (where?.isActive === true) {
          return rules.filter((r) => r.isActive);
        }
        return rules;
      }),
  };
}

function fakeUserModel(users: Array<{ id: string; role: Role; plantId: string | null }>) {
  return {
    findOne: jest.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      const match = users.find((u) => {
        if (u.role !== where.role) return false;
        if (where.plantId !== undefined) {
          const expected = (where.plantId as { [k: symbol]: unknown } | string | null);
          if (typeof expected === 'string' || expected === null) {
            return u.plantId === expected;
          }
          // Op.eq wrapper - extract null value
          return u.plantId === null;
        }
        return true;
      });
      return match ?? null;
    }),
  };
}

function newService(rules: Rule[], users: Array<{ id: string; role: Role; plantId: string | null }>) {
  return new RulesEngineService(
    fakeRuleModel(rules) as unknown as never,
    fakeUserModel(users) as unknown as never,
  );
}

const tierRules: Rule[] = [
  {
    id: 'r1',
    ruleName: 'Tier-1',
    minAmount: null,
    maxAmount: 10_000,
    roleChain: [Role.FINANCE_DIRECTOR],
    priority: 10,
    isActive: true,
  },
  {
    id: 'r2',
    ruleName: 'Tier-2',
    minAmount: 10_000,
    maxAmount: 50_000,
    roleChain: [Role.PLANT_MANAGER, Role.FINANCE_DIRECTOR],
    priority: 20,
    isActive: true,
  },
  {
    id: 'r3',
    ruleName: 'Tier-3',
    minAmount: 50_000,
    maxAmount: null,
    roleChain: [Role.PLANT_MANAGER, Role.FINANCE_DIRECTOR, Role.VP_FINANCE],
    priority: 30,
    isActive: true,
  },
];

const users = [
  { id: 'pm1', role: Role.PLANT_MANAGER, plantId: 'PLT-001' },
  { id: 'pm2', role: Role.PLANT_MANAGER, plantId: 'PLT-002' },
  { id: 'fd1', role: Role.FINANCE_DIRECTOR, plantId: null },
  { id: 'vp1', role: Role.VP_FINANCE, plantId: null },
];

describe('RulesEngineService', () => {
  describe('computeApprovalChain', () => {
    test('Tier 1: $5,000 -> [FD]', async () => {
      const svc = newService(tierRules, users);
      const r = await svc.computeApprovalChain(5_000, 'PLT-001');
      expect(r.rule.name).toBe('Tier-1');
      expect(r.roleChain).toEqual([Role.FINANCE_DIRECTOR]);
      expect(r.userChain).toEqual(['fd1']);
    });

    test('Tier 2: $25,000 -> [PM, FD] resolves PM for plant', async () => {
      const svc = newService(tierRules, users);
      const r = await svc.computeApprovalChain(25_000, 'PLT-002');
      expect(r.rule.name).toBe('Tier-2');
      expect(r.userChain).toEqual(['pm2', 'fd1']);
    });

    test('Tier 3: $75,000 -> [PM, FD, VP]', async () => {
      const svc = newService(tierRules, users);
      const r = await svc.computeApprovalChain(75_000, 'PLT-001');
      expect(r.rule.name).toBe('Tier-3');
      expect(r.userChain).toEqual(['pm1', 'fd1', 'vp1']);
    });

    test('boundary: $10,000 falls into Tier 1 (max inclusive)', async () => {
      const svc = newService(tierRules, users);
      const r = await svc.computeApprovalChain(10_000, 'PLT-001');
      expect(r.rule.name).toBe('Tier-1');
    });

    test('boundary: $10,000.01 falls into Tier 2 (min exclusive)', async () => {
      const svc = newService(tierRules, users);
      const r = await svc.computeApprovalChain(10_000.01, 'PLT-001');
      expect(r.rule.name).toBe('Tier-2');
    });

    test('throws when no rule matches the amount', async () => {
      const svc = newService(
        [
          {
            id: 'only',
            ruleName: 'OnlyTier',
            minAmount: 100,
            maxAmount: 200,
            roleChain: [Role.FINANCE_DIRECTOR],
            priority: 10,
            isActive: true,
          },
        ],
        users,
      );
      await expect(svc.computeApprovalChain(50, 'PLT-001')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    test('throws with clear message when PM cannot be resolved for plant', async () => {
      const svc = newService(tierRules, [
        { id: 'fd1', role: Role.FINANCE_DIRECTOR, plantId: null },
      ]);
      await expect(
        svc.computeApprovalChain(25_000, 'PLT-001'),
      ).rejects.toThrow(/Plant_Manager/);
    });

    test('inactive rules are ignored', async () => {
      const svc = newService(
        [
          { ...tierRules[0], isActive: false },
          tierRules[1],
          tierRules[2],
        ],
        users,
      );
      // 5000 would normally match Tier 1, but it's inactive -> no match
      await expect(svc.computeApprovalChain(5_000, 'PLT-001')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
