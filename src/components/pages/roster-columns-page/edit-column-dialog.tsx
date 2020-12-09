import React, { useState } from 'react';
import {
  Button, Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Select,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@material-ui/core';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import axios from 'axios';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import useStyles from './edit-column-dialog.styles';
import {
  ApiRosterColumnInfo,
  ApiRosterColumnType,
  ApiRosterCustomColumnConfig,
  ApiRosterEnumColumnConfig,
  ApiRosterEnumColumnConfigOption,
  ApiRosterStringColumnConfig,
  rosterColumnTypeDisplayName,
} from '../../../models/api-response';
import { EditableBooleanTable } from '../../tables/editable-boolean-table';

export interface EditColumnDialogProps {
  open: boolean,
  orgId?: number,
  column?: ApiRosterColumnInfo,
  onClose?: () => void,
  onError?: (error: string) => void,
}

type CustomFlag = {
  label: string
  key: keyof Pick<ApiRosterStringColumnConfig, 'multiline'>
};

const customFlagsForType = (type: ApiRosterColumnType): CustomFlag[] => {
  switch (type) {
    case ApiRosterColumnType.String:
      return [{
        label: 'Multiline',
        key: 'multiline',
      }];
    default:
      return [];
  }
};

const isCustomFlagSet = (config: ApiRosterCustomColumnConfig, type: ApiRosterColumnType, customFlag: CustomFlag): boolean => {
  if (type === ApiRosterColumnType.String) {
    const cfg = config as ApiRosterStringColumnConfig;
    return cfg[customFlag.key] === true;
  }
  return false;
};

const setCustomFlag = (config: ApiRosterCustomColumnConfig, type: ApiRosterColumnType, customFlag: CustomFlag, value: boolean) => {
  if (type === ApiRosterColumnType.String) {
    const cfg = config as ApiRosterStringColumnConfig;
    cfg[customFlag.key] = value;
  }
  return { ...config };
};

const getEnumOptions = (config: ApiRosterCustomColumnConfig, type: ApiRosterColumnType): ApiRosterEnumColumnConfigOption[] => {
  if (type !== ApiRosterColumnType.Enum) {
    throw new Error('Invalid call to getEnumOptions for non-enum type');
  }
  return (config as ApiRosterEnumColumnConfig).options ?? [];
};

const addEnumOption = (config: ApiRosterCustomColumnConfig, type: ApiRosterColumnType): ApiRosterEnumColumnConfig => {
  return {
    ...config,
    options: [...getEnumOptions(config, type), {
      id: uuidv4(),
      label: '',
    }],
  };
};

const editEnumOption = (config: ApiRosterCustomColumnConfig, type: ApiRosterColumnType, id: string, label: string): ApiRosterEnumColumnConfig => {
  return {
    ...config,
    options: getEnumOptions(config, type).map(option => {
      if (option.id === id) {
        option.label = label;
      }
      return option;
    }),
  };
};

const deleteEnumOption = (config: ApiRosterCustomColumnConfig, type: ApiRosterColumnType, id: string): ApiRosterEnumColumnConfig => {
  return {
    ...config,
    options: getEnumOptions(config, type).filter(option => option.id !== id),
  };
};

export const EditColumnDialog = (props: EditColumnDialogProps) => {
  const classes = useStyles();
  const [formDisabled, setFormDisabled] = useState(false);
  const {
    open, orgId, column, onClose, onError,
  } = props;

  const existingColumn: boolean = !!column;
  const [name, setName] = useState(column?.name || '');
  const [displayName, setDisplayName] = useState(column?.displayName || '');
  const [type, setType] = useState(column?.type || ApiRosterColumnType.String);
  const [pii, setPII] = useState(column?.pii || false);
  const [phi, setPHI] = useState(column?.phi || false);
  const [required, setRequired] = useState(column?.required || false);
  const [config, setConfig] = useState<ApiRosterCustomColumnConfig>(column?.config || {});

  if (!open) {
    return <></>;
  }

  const onInputChanged = (func: (f: string) => any) => (event: React.ChangeEvent<HTMLInputElement>) => {
    func(event.target.value);
  };

  const onColumnTypeChanged = (event: React.ChangeEvent<{ value: unknown }>) => {
    setType(event.target.value as ApiRosterColumnType);
  };

  const onFlagChanged = (func: (f: boolean) => any) => (event: React.ChangeEvent<HTMLInputElement>) => {
    func(event.target.checked);
  };

  const onCustomFlagChanged = (customFlag: CustomFlag) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(setCustomFlag(config, type, customFlag, event.target.checked));
  };

  const onCustomEnumChanged = (id: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(editEnumOption(config, type, id, event.target.value));
  };

  const onSave = async () => {
    setFormDisabled(true);
    const body = {
      name,
      displayName,
      type,
      pii: pii || phi,
      phi,
      required,
      config,
    };
    try {
      if (existingColumn) {
        await axios.put(`api/roster/${orgId}/column/${column!.name}`, body);
      } else {
        await axios.post(`api/roster/${orgId}/column`, body);
      }
    } catch (error) {
      if (onError) {
        let message = 'Internal Server Error';
        if (error.response?.data?.errors && error.response.data.errors.length > 0) {
          message = error.response.data.errors[0].message;
        }
        onError(message);
      }
      setFormDisabled(false);
      return;
    }
    if (onClose) {
      onClose();
    }
  };

  const canSave = () => {
    return !formDisabled && name.length > 0 && displayName.length > 0;
  };

  return (
    <Dialog className={classes.root} maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle id="alert-dialog-title">{existingColumn ? 'Edit Roster Column' : 'New Roster Column'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <Typography className={classes.headerLabel}>Field Name:</Typography>
            {existingColumn && (
              <Typography>
                {name}
              </Typography>
            )}
            {!existingColumn && (
              <TextField
                className={classes.textField}
                id="field-name"
                disabled={formDisabled}
                value={name}
                onChange={onInputChanged(setName)}
              />
            )}
          </Grid>
          <Grid item xs={6}>
            <Typography className={classes.headerLabel}>Type:</Typography>
            {existingColumn && (
              <Typography className={classes.typeText}>
                {type}
              </Typography>
            )}
            {!existingColumn && (
              <Select
                className={classes.typeSelect}
                native
                disabled={formDisabled}
                value={type}
                onChange={onColumnTypeChanged}
                inputProps={{
                  name: 'type',
                  id: 'type-select',
                }}
              >
                {Object.values(ApiRosterColumnType).map(columnType => (
                  <option key={columnType} value={columnType}>{rosterColumnTypeDisplayName(columnType)}</option>
                ))}
              </Select>
            )}
          </Grid>
          <Grid container item xs={6}>
            <Grid item xs={12}>
              <Typography className={classes.headerLabel}>Display Name:</Typography>
              <TextField
                className={classes.textField}
                id="display-name"
                disabled={formDisabled}
                multiline
                rowsMax={2}
                value={displayName}
                onChange={onInputChanged(setDisplayName)}
              />
            </Grid>
            {type === ApiRosterColumnType.Enum && (
              <Grid container item xs={12}>
                <Grid item xs={12}>
                  <Typography className={clsx(classes.headerLabel, classes.optionsHeaderLabel)}>
                    Options:
                  </Typography>
                </Grid>

                {getEnumOptions(config, type).map(({ id, label }) => (
                  <Grid key={id} container item xs={12} spacing={1}>
                    <Grid item xs={10}>
                      <TextField
                        className={classes.textField}
                        disabled={formDisabled}
                        onChange={onCustomEnumChanged(id)}
                        size="small"
                        value={label}
                      />
                    </Grid>
                    <Grid item xs={2}>
                      <IconButton
                        className={classes.removeEnumButton}
                        onClick={() => deleteEnumOption(config, type, id)}
                      >
                        <HighlightOffIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}

                <Grid item xs={12}>
                  <Button
                    aria-label="Add option"
                    className={classes.addEnumButton}
                    onClick={() => setConfig(addEnumOption(config, type))}
                    size="small"
                    startIcon={<AddCircleIcon />}
                    variant="outlined"
                  >
                    Add Option
                  </Button>
                </Grid>
              </Grid>
            )}
          </Grid>
          <Grid item xs={6}>
            <Typography className={classes.headerLabel}>Column Flags:</Typography>
            <EditableBooleanTable aria-label="Flags">
              <TableRow>
                <TableCell>Contains PII</TableCell>
                <TableCell>
                  <Checkbox
                    color="primary"
                    disabled={formDisabled || phi}
                    checked={pii || phi}
                    onChange={onFlagChanged(setPII)}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Contains PHI</TableCell>
                <TableCell>
                  <Checkbox
                    color="primary"
                    disabled={formDisabled}
                    checked={phi}
                    onChange={onFlagChanged(setPHI)}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Required</TableCell>
                <TableCell>
                  <Checkbox
                    color="primary"
                    disabled={formDisabled}
                    checked={required}
                    onChange={onFlagChanged(setRequired)}
                  />
                </TableCell>
              </TableRow>
              {customFlagsForType(type).map((flag: CustomFlag) => (
                <TableRow key={flag.key}>
                  <TableCell>{flag.label}</TableCell>
                  <TableCell>
                    <Checkbox
                      color="primary"
                      disabled={formDisabled}
                      checked={isCustomFlagSet(config, type, flag)}
                      onChange={onCustomFlagChanged(flag)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </EditableBooleanTable>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button disabled={formDisabled} variant="outlined" onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button disabled={!canSave()} onClick={onSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
