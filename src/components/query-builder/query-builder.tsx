import React, { useEffect, useState } from 'react';
import {
  Button, Collapse, Grid, IconButton, Select, Switch, TextField,
} from '@material-ui/core';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import MomentUtils from '@date-io/moment';
import { DatePicker, DateTimePicker, MuiPickersUtilsProvider } from '@material-ui/pickers';
import moment, { Moment } from 'moment';
import useStyles from './query-builder.styles';
import useDebounced from '../../hooks/use-debounced';
import useDeepEquality from '../../hooks/use-deep-equality';

const toDate = (date: Moment) => date.format('Y-M-D');

export enum QueryFieldType {
  String = 'string',
  Boolean = 'boolean',
  Date = 'date',
  DateTime = 'datetime',
  Number = 'number',
  Enum = 'enum',
}

export type QueryOp = '=' | '<>' | '~' | '>' | '<' | 'startsWith' | 'endsWith' | 'in' | 'between';
export type QueryValueScalarType = string | number | boolean | undefined;
export type QueryValueType = QueryValueScalarType | QueryValueScalarType[];

export type QueryFieldPickListItem = {
  label: string
  value: string | number
};

export type QueryField = {
  editor?: React.ReactElement<ValueEditorProps>
  displayName?: string
  name: string
  type: QueryFieldType
  items?: QueryFieldPickListItem[],
};

export type QueryRow = {
  field: QueryField
  op: QueryOp
  value: QueryValueType
};

export type QueryFilterState = {
  [key: string]: {
    op: QueryOp
    value: QueryValueType
  }
};

interface ValueEditorProps {
  onChange: (row: QueryRow) => void
  row: QueryRow
}

const StringValue = ({ onChange, row }: ValueEditorProps) => {
  const classes = useStyles();

  return (
    <TextField
      className={classes.textField}
      onChange={event => {
        row.value = event.target.value;
        onChange({ ...row });
      }}
      placeholder={row.field.displayName}
      type={row.field.type === QueryFieldType.Number ? 'number' : 'text'}
      value={row.value}
    />
  );
};

const BooleanValue = ({ onChange, row }: ValueEditorProps) => {
  return (
    <Switch
      checked={Boolean(row.value)}
      onChange={event => {
        row.value = event.target.checked;
        onChange({ ...row });
      }}
      color="primary"
      inputProps={{ 'aria-label': 'primary checkbox' }}
    />
  );
};

interface DateTimeValueEditorProps extends ValueEditorProps {
  hasTime: boolean
}

const DateTimeValue = ({ hasTime, onChange, row }: DateTimeValueEditorProps) => {
  const classes = useStyles();

  useEffect(() => {
    if (!row.value) {
      onChange({ ...row, value: getDefaultValueForType(row.field) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Picker = hasTime ? DateTimePicker : DatePicker;

  return (
    <MuiPickersUtilsProvider utils={MomentUtils}>
      <Picker
        className={classes.textField}
        id={row.field.name}
        format={hasTime ? 'MM/DD/YYYY hh:mm A' : 'MM/DD/YYYY'}
        placeholder={row.field.displayName}
        value={moment((row.value ? row.value : getDefaultValueForType(row.field)) as string)}
        onChange={date => {
          if (date) {
            row.value = hasTime ? date.format() : toDate(date);
          } else {
            row.value = getDefaultValueForType(row.field);
          }
          onChange({ ...row });
        }}
      />
    </MuiPickersUtilsProvider>
  );
};

interface RangeValueEditorProps extends ValueEditorProps {
  component: React.ReactElement<ValueEditorProps>
}

const RangeValue = ({ component, onChange, row }: RangeValueEditorProps) => {
  const array = [undefined, undefined]
    .map((_: any, index: number) => {
      return (Array.isArray(row.value) && row.value.length > index) ? row.value[index] : _;
    });

  return (
    <Grid item container spacing={2}>
      {array.map((value: QueryValueType, index: number) => (
        <Grid item key={['min', 'max'][index]}>
          {React.cloneElement(component, {
            onChange: ({ value: subValue }: QueryRow) => {
              array[index] = subValue;
              row.value = array.slice();
              onChange(row);
            },
            row: { ...row, value },
          })}
        </Grid>
      ))}
    </Grid>
  );
};

const PickListValue = (props: ValueEditorProps) => {
  const classes = useStyles();

  const { onChange, row } = props;
  return (
    <Select
      native
      autoFocus
      className={classes.pickListSelect}
      value={row.value}
      onChange={event => {
        onChange({
          ...row,
          value: event.target.value as string | number,
        });
      }}
    >
      {row.field.items!.map(({ label, value }) => (
        <option key={label} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
};

const Editor = (props: ValueEditorProps) => {
  let { editor } = props.row.field;

  if (!editor) {
    if (props.row.field.items) {
      editor = <PickListValue {...props} />;
    } else {
      switch (props.row.field.type) {
        case QueryFieldType.Date:
          editor = <DateTimeValue hasTime={false} {...props} />;
          break;
        case QueryFieldType.DateTime:
          editor = <DateTimeValue hasTime {...props} />;
          break;
        case QueryFieldType.Boolean:
          editor = <BooleanValue {...props} />;
          break;
        default:
          editor = <StringValue {...props} />;
      }
    }
  }

  if (props.row.op === 'between') {
    return <RangeValue component={editor} {...props} />;
  }
  return editor;
};

type FieldSelectorProps = {
  fields: QueryField[]
  onChange: (field: QueryField) => void
};

const FieldSelector = (props: FieldSelectorProps) => {
  const { fields, onChange } = props;
  return (
    <Select
      native
      autoFocus
      fullWidth
      onChange={event => {
        onChange(fields[event.target.value as number]);
      }}
    >
      {fields.map((field, index) => (
        <option key={field.name} value={index}>
          {field.displayName}
        </option>
      ))}
    </Select>
  );
};

type OpsDesc = {
  [key: string]: string
};

type QueryOpSelectorProps = {
  onChange: (op: QueryOp) => void
  value: QueryOp
  ops: OpsDesc
};

const getOpDesc = (field: QueryField): OpsDesc => {
  if (field.items || field.type === QueryFieldType.Boolean) {
    return {
      '=': 'is',
      '<>': 'is not',
    };
  }
  if (field.type === QueryFieldType.String) {
    return {
      '=': 'is',
      '<>': 'is not',
      '~': 'contains',
      startsWith: 'starts with',
      endsWith: 'ends with',
    };
  }
  if (field.type === QueryFieldType.Date || field.type === QueryFieldType.DateTime) {
    return {
      '=': 'is',
      '<>': 'is not',
      '>': 'after',
      '<': 'before',
      between: 'between',
    };
  }
  if (field.type === QueryFieldType.Number) {
    return {
      '=': 'is',
      '<>': 'is not',
      '>': 'greater than',
      '<': 'less than',
      between: 'between',
    };
  }
  return {};
};

const getDefaultOp = (field: QueryField): QueryOp => {
  const opDesc = getOpDesc(field);
  if (opDesc) {
    return Object.keys(opDesc)[0] as QueryOp;
  }
  return '=';
};

const isArrayOp = (op: QueryOp) => op === 'between' || op === 'in';

const getDefaultValueForType = (field: QueryField): QueryValueScalarType => {
  if (field.items?.length) {
    return field.items[0].value;
  }
  if (field.type === QueryFieldType.Boolean) {
    return false;
  }
  if (field.type === QueryFieldType.Date) {
    return toDate(moment());
  }
  if (field.type === QueryFieldType.DateTime) {
    const today = new Date(Date.now());
    return today.toISOString();
  }
  return '';
};

const getDefaultValue = (field: QueryField, op: QueryOp): QueryValueType => {
  const isArray = isArrayOp(op);
  const value = getDefaultValueForType(field);
  return isArray ? [value] : value;
};

const getNewValue = (row: QueryRow, newField: QueryField, newOp: QueryOp): QueryValueType => {
  if (row.field.items || newField.items) {
    return getDefaultValueForType(newField);
  }
  if (row.field.type === newField.type) {
    if (isArrayOp(row.op) === isArrayOp(newOp)) {
      return row.value;
    }
    if (isArrayOp(newOp)) {
      return [row.value as QueryValueScalarType];
    }
    if (Array.isArray(row.value)) {
      return row.value[0];
    }
  }
  return getDefaultValueForType(newField);
};

const QueryOpSelector = (props: QueryOpSelectorProps) => {
  const { onChange, ops, value } = props;
  return (
    <Select
      native
      autoFocus
      fullWidth
      value={value}
      onChange={event => {
        onChange(event.target.value as QueryOp);
      }}
    >
      {Object.entries(ops).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </Select>
  );
};

type QueryBuilderRowProps = {
  availableFields: QueryField[]
  onChange: (row: QueryRow) => void
  row: QueryRow
};

const QueryBuilderRow = (props: QueryBuilderRowProps) => {
  const {
    availableFields, onChange, row,
  } = props;

  const ops = getOpDesc(row.field);

  return (
    <>
      <Grid item xs={3}>
        <FieldSelector
          fields={[row.field, ...availableFields].filter(Boolean) as QueryField[]}
          onChange={field => {
            const newOps = getOpDesc(field);
            const op = row.op in newOps ? row.op : getDefaultOp(field);
            onChange({ field, op, value: getNewValue(row, field, op) });
          }}
        />
      </Grid>

      {ops && (
        <Grid item xs={2}>
          <QueryOpSelector
            onChange={op => {
              onChange({ field: row.field, op, value: getNewValue(row, row.field, op) });
            }}
            ops={ops}
            value={row.op}
          />
        </Grid>
      )}

      <Grid item>
        <Editor onChange={onChange} row={row} />
      </Grid>
    </>
  );
};

export interface QueryBuilderProps {
  fields: QueryField[]
  onChange: (query: QueryFilterState | undefined) => void
  open: boolean
}

export const QueryBuilder = (props: QueryBuilderProps) => {
  const classes = useStyles();
  const {
    fields, onChange, open,
  } = props;
  const [rows, setRows] = useState<QueryRow[]>([]);
  const availableFields = fields.filter(field => !rows.some(row => row.field.name === field.name));
  const [filterState, setFilterState] = useDeepEquality<QueryFilterState | undefined>();
  const debouncedRows = useDebounced(rows, 333);

  const addRow = () => {
    if (availableFields.length > 0) {
      const field = availableFields[0];
      const op = getDefaultOp(field);
      setRows([...rows, { field, op, value: getDefaultValue(field, op) }]);
    }
  };

  const removeRow = (rowIndex: number) => () => {
    setRows(rows.filter((_, index) => index !== rowIndex));
  };

  const onRowChange = (index: number) => (row: QueryRow) => {
    const newRows = [...rows];
    newRows.splice(index, 1, row);
    setRows(newRows);
  };

  useEffect(() => {
    const queryableRows = debouncedRows.filter(row => row.field && row.value !== '');
    const query = queryableRows.length && queryableRows.reduce(
      (accum, { field, op, value }) => {
        accum[field!.name] = { op, value };
        return accum;
      }, {} as QueryFilterState,
    );

    setFilterState(query || undefined);
  }, [debouncedRows, setFilterState]);

  useEffect(() => {
    onChange(filterState);
  }, [filterState, onChange]);

  useEffect(() => {
    if (open && rows.length === 0) {
      addRow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className={classes.root}>
      <Collapse in={open}>
        <div className={classes.rowsContainer}>
          {rows.map((row, index) => (
            <Grid container spacing={2} key={row.field.name}>
              <QueryBuilderRow
                availableFields={availableFields}
                onChange={onRowChange(index)}
                row={row}
              />
              <IconButton
                className={classes.removeRowButton}
                onClick={removeRow(index)}
              >
                <HighlightOffIcon />
              </IconButton>
            </Grid>
          ))}
        </div>
        {rows.every(row => row.field) && (
          <Button
            aria-label="Add filter"
            className={classes.addRowButton}
            onClick={addRow}
            size="small"
            startIcon={<AddCircleIcon />}
            variant="outlined"
          >
            Add Filter
          </Button>
        )}
      </Collapse>
    </div>
  );
};
