import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';
import {
  CustomColumns,
  RosterColumnInfo,
  RosterColumnType,
} from './roster.types';
import { Org } from '../org/org.model';
import { Role } from '../role/role.model';
import { Unit } from '../unit/unit.model';
import { CustomRosterColumn } from './custom-roster-column.model';

@Entity()
export class Roster extends BaseEntity {

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Unit, unit => unit.id, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  unit!: Unit;

  @Column({
    length: 10,
  })
  edipi!: string;

  @Column({
    length: 100,
  })
  firstName!: string;

  @Column({
    length: 100,
  })
  lastName!: string;

  @Column({
    type: 'date',
    nullable: true,
    default: () => 'null',
  })
  startDate?: Date;

  @Column({
    type: 'date',
    nullable: true,
    default: () => 'null',
  })
  endDate?: Date;

  @CreateDateColumn({
    nullable: true,
    default: () => 'null',
  })
  lastReported?: Date;

  @Column('json', {
    nullable: false,
    default: '{}',
  })
  customColumns: CustomColumns;

  getColumnValue(column: RosterColumnInfo) {
    if (column.custom) {
      return this.customColumns[column.name] || null;
    }

    if (column.type === RosterColumnType.Date || column.type === RosterColumnType.DateTime) {
      const dateValue: Date = Reflect.get(this, column.name);
      return dateValue ? dateValue.toISOString() : null;
    }

    return Reflect.get(this, column.name) || null;
  }

  static getColumnSelect(column: RosterColumnInfo) {
    // Make sure custom columns are converted to appropriate types
    if (column.custom) {
      switch (column.type) {
        case RosterColumnType.Boolean:
          return `(roster.custom_columns ->> '${column.name}')::BOOLEAN`;
        case RosterColumnType.Number:
          return `(roster.custom_columns ->> '${column.name}')::DOUBLE PRECISION`;
        default:
          return `roster.custom_columns ->> '${column.name}'`;
      }
    }
    return `roster.${snakeCase(column.name)}`;
  }

  static async queryAllowedRoster(org: Org, role: Role) {
    //
    // Query the roster, returning only columns and rows that are allowed for the role of the requester.
    //
    const columns = await Roster.getAllowedColumns(org, role);
    const queryBuilder = Roster.createQueryBuilder('roster').select([]);
    queryBuilder.leftJoin('roster.unit', 'u');
    // Always select the id column
    queryBuilder.addSelect('roster.id', 'id');
    queryBuilder.addSelect('u.id', 'unit');

    // Add all columns that are allowed by the user's role
    columns.forEach(column => {
      queryBuilder.addSelect(Roster.getColumnSelect(column), column.name);
    });

    // Filter out roster entries that are not on the active roster or are not allowed by the role's index prefix.
    return queryBuilder
      .where('u.org_id = :orgId', { orgId: org.id })
      .andWhere('(roster.end_date IS NULL OR roster.end_date >= CURRENT_DATE)')
      .andWhere('(roster.start_date IS NULL OR roster.start_date <= CURRENT_DATE)')
      .andWhere('u.id like :name', { name: role.indexPrefix.replace('*', '%') });
  }

  static async getAllowedColumns(org: Org, role: Role) {
    const allColumns = await Roster.getColumns(org.id);
    const fineGrained = !(role.allowedRosterColumns.length === 1 && role.allowedRosterColumns[0] === '*');
    return allColumns.filter(column => {
      let allowed = true;
      if (fineGrained && role.allowedRosterColumns.indexOf(column.name) < 0) {
        allowed = false;
      } else if (!role.canViewPII && column.pii) {
        allowed = false;
      } else if (!role.canViewPHI && column.phi) {
        allowed = false;
      }
      return allowed;
    });
  }

  static async getColumns(orgId: number) {
    const customColumns = (await CustomRosterColumn.find({
      where: {
        org: orgId,
      },
    })).map(customColumn => {
      const columnInfo: RosterColumnInfo = {
        ...customColumn,
        displayName: customColumn.display,
        custom: true,
        updatable: true,
      };
      return columnInfo;
    });
    return [...baseRosterColumns, ...customColumns];
  }
}

export const baseRosterColumns: RosterColumnInfo[] = [
  {
    name: 'edipi',
    displayName: 'EDIPI',
    type: RosterColumnType.String,
    pii: true,
    phi: false,
    custom: false,
    required: true,
    updatable: false,
  }, {
    name: 'firstName',
    displayName: 'First Name',
    type: RosterColumnType.String,
    pii: true,
    phi: false,
    custom: false,
    required: true,
    updatable: true,
  }, {
    name: 'lastName',
    displayName: 'Last Name',
    type: RosterColumnType.String,
    pii: true,
    phi: false,
    custom: false,
    required: true,
    updatable: true,
  }, {
    name: 'startDate',
    displayName: 'Start Date',
    type: RosterColumnType.Date,
    pii: false,
    phi: false,
    custom: false,
    required: false,
    updatable: true,
  }, {
    name: 'endDate',
    displayName: 'End Date',
    type: RosterColumnType.Date,
    pii: false,
    phi: false,
    custom: false,
    required: false,
    updatable: true,
  }, {
    name: 'lastReported',
    displayName: 'Last Reported',
    type: RosterColumnType.DateTime,
    pii: false,
    phi: false,
    custom: false,
    required: false,
    updatable: true,
  },
];
