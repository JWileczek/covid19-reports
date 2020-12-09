import {
  Entity, Column, BaseEntity, JoinColumn, ManyToOne, PrimaryColumn,
} from 'typeorm';
import { Org } from '../org/org.model';
import { RosterColumnType } from './roster.types';

@Entity()
export class CustomRosterColumn extends BaseEntity {

  @PrimaryColumn()
  name!: string;

  @ManyToOne(() => Org, org => org.id, {
    primary: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'org_id',
  })
  org?: Org;

  @Column({
    length: 100,
  })
  display!: string;

  @Column({
    type: 'enum',
    enum: RosterColumnType,
    default: RosterColumnType.String,
  })
  type!: RosterColumnType;

  @Column({
    default: false,
  })
  pii!: boolean;

  @Column({
    default: false,
  })
  phi!: boolean;

  @Column({
    default: false,
  })
  required!: boolean;

  @Column('json', {
    nullable: false,
    default: '{}',
  })
  config!: CustomColumnConfig;
}

export interface CustomColumnConfig {}
