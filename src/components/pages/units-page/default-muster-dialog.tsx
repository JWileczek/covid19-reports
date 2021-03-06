import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@material-ui/core';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import axios from 'axios';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';
import { Autocomplete } from '@material-ui/lab';
import { MuiPickersUtilsProvider, TimePicker } from '@material-ui/pickers';
import MomentUtils from '@date-io/moment';
import { MaterialUiPickersDate } from '@material-ui/pickers/typings/date';
import { useSelector } from 'react-redux';
import useStyles from './default-muster-dialog.styles';
import { MusterConfiguration } from '../../../models/api-response';
import { DaysOfTheWeek } from '../../../utility/days';
import { UserSelector } from '../../../selectors/user.selector';
import MusterConfigReadable from './muster-config-readable';
import { validateMusterConfiguration } from '../../../utility/muster-utils';
import { HelpCard } from '../../help/help-card/help-card';
import { UnitSelector } from '../../../selectors/unit.selector';

export interface DefaultMusterDialogProps {
  open: boolean,
  onClose?: (success?: boolean) => void,
  onError?: (error: string) => void,
}

interface MusterConfigurationRow extends MusterConfiguration {
  rowKey: string,
  durationHours: number,
  startTimeDate: Date,
}

export const DefaultMusterDialog = (props: DefaultMusterDialogProps) => {
  const classes = useStyles();
  const [formDisabled, setFormDisabled] = useState(false);
  const org = useSelector(UserSelector.org);
  const units = useSelector(UnitSelector.all)
    .filter(unit => unit.musterConfiguration === null);
  const orgId = org?.id;
  const defaultMusterConfiguration = org?.defaultMusterConfiguration;
  const {
    open, onClose, onError,
  } = props;

  const onCancel = () => {
    if (onClose) {
      onClose(false);
    }
  };

  const musterRows = (musterConfiguration?: MusterConfiguration[]) => {
    const today = moment().format('Y-M-D');
    return musterConfiguration?.map(muster => {
      return {
        ...muster,
        durationHours: muster.durationMinutes / 60,
        rowKey: uuidv4(),
        startTimeDate: moment(`${today} ${muster.startTime}`, 'Y-M-D h:mm').toDate(),
      };
    });
  };

  const [musterConfiguration, setMusterConfiguration] = useState<MusterConfigurationRow[]>(musterRows(defaultMusterConfiguration) || []);
  const [errorMessage, setErrorMessage] = React.useState<null | string>(null);

  const hasChanges = React.useCallback(() => {
    return JSON.stringify(defaultMusterConfiguration) !== JSON.stringify(musterConfiguration.map(({ durationHours, rowKey, startTimeDate, ...muster }) => muster));
  }, [defaultMusterConfiguration, musterConfiguration]);

  if (!open) {
    return null;
  }

  const hasDefaultMuster = musterConfiguration.length > 0;

  const addMusterWindow = () => {
    const configuration = [...musterConfiguration, {
      days: DaysOfTheWeek.None,
      startTime: '00:00',
      timezone: moment.tz.guess(),
      durationMinutes: 120,
      durationHours: 2,
      rowKey: uuidv4(),
      startTimeDate: moment(`${moment().format('Y-M-D')} 00:00`, 'Y-M-D h:mm').toDate(),
    }];
    setMusterConfiguration(configuration);
  };

  const resetErrorMessage = () => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const setMusterTimezone = (rowKey: string) => (_: any, timezone: string) => {
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      configuration[index].timezone = timezone;
    }
    setMusterConfiguration(configuration);
    resetErrorMessage();
  };

  const setMusterDuration = (rowKey: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = Math.max(0.5, parseFloat(event.target.value));
    if (Number.isNaN(value)) {
      value = 0.5;
    }
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      configuration[index].durationHours = value;
      configuration[index].durationMinutes = value * 60;
    }
    setMusterConfiguration(configuration);
    resetErrorMessage();
  };

  const setMusterStartTime = (rowKey: string) => (date: MaterialUiPickersDate) => {
    if (!date) {
      return;
    }
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      configuration[index].startTimeDate = date.toDate();
      configuration[index].startTime = date.format('H:mm');
    }
    setMusterConfiguration(configuration);
    resetErrorMessage();
  };

  const toggleMusterDay = (rowKey: string, day: DaysOfTheWeek) => () => {
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      // eslint-disable-next-line no-bitwise
      configuration[index].days ^= day;
    }
    if (!configuration.find(muster => muster.days === DaysOfTheWeek.None)) {
      resetErrorMessage();
    }
    setMusterConfiguration(configuration);
  };

  const removeMusterWindow = (rowKey: string) => {
    setMusterConfiguration(previous => {
      const configuration = [...previous];
      const index = configuration.findIndex(muster => muster.rowKey === rowKey);
      if (index >= 0) {
        configuration.splice(index, 1);
      }
      return configuration;
    });
  };

  const validateMusterWindows = () => {
    const validation = validateMusterConfiguration(musterConfiguration);
    if (validation) {
      setErrorMessage(validation);
      return false;
    }
    return true;
  };

  const onSave = async () => {
    if (!validateMusterWindows()) {
      return;
    }
    setFormDisabled(true);
    const body = {
      defaultMusterConfiguration: musterConfiguration.map(muster => {
        return {
          days: muster.days,
          startTime: muster.startTime,
          timezone: muster.timezone,
          durationMinutes: muster.durationMinutes,
        };
      }),
    };
    try {
      await axios.put(`api/org/${orgId}/default-muster`, body);
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
      onClose(true);
    }
  };

  const canSave = () => {
    return !formDisabled && !validateMusterConfiguration(musterConfiguration) && hasChanges();
  };

  const dayButtonClass = (muster: MusterConfigurationRow, day: DaysOfTheWeek) => {
    if (errorMessage && muster.days === DaysOfTheWeek.None) {
      return classes.dayButtonError;
    }
    // eslint-disable-next-line no-bitwise
    return muster.days & day ? classes.dayButtonOn : classes.dayButtonOff;
  };

  /* eslint-disable no-bitwise */
  return (
    <Dialog className={classes.root} maxWidth="md" onClose={onCancel} open={open}>
      <DialogTitle id="alert-dialog-title">Default Muster Requirements</DialogTitle>
      <DialogContent>
        <HelpCard helpCardId="default-muster-dialog">
          <Typography>
            By configuring the default muster requirements you can quickly apply shared requirements across all new and existing units within a group. This setting can be overridden for the unique requirements of each unit.
          </Typography>
        </HelpCard>
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <Typography variant="subtitle2">
              Current Requirements
            </Typography>
            <Box className={classes.atAGlance}>
              <MusterConfigReadable musterConfiguration={musterConfiguration} />
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2">
              Affected Units
            </Typography>

            <Box className={classes.atAGlance}>
              {units?.length ? (
                <div className={classes.unitsContainer}>
                  {units.map(unit => <div key={unit.id}>{unit.name}</div>)}
                </div>
              ) : (
                <Typography className={classes.noUnits}>
                  None of your units use the default.
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
        {hasDefaultMuster && (
          <Table aria-label="muster table" className={classes.musterTable}>
            <TableHead>
              <TableRow>
                <TableCell>Days</TableCell>
                <TableCell>Start Time</TableCell>
                <TableCell>Time Zone</TableCell>
                <TableCell>Duration (Hrs)</TableCell>
                <TableCell className={classes.iconCell} />
              </TableRow>
            </TableHead>
            <TableBody>
              {musterConfiguration.map(muster => (
                <TableRow key={muster.rowKey}>
                  <TableCell>
                    <div className={classes.dayButtons}>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Sunday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Sunday)}
                      >
                        Su
                      </Avatar>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Monday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Monday)}
                      >
                        Mo
                      </Avatar>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Tuesday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Tuesday)}
                      >
                        Tu
                      </Avatar>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Wednesday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Wednesday)}
                      >
                        We
                      </Avatar>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Thursday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Thursday)}
                      >
                        Th
                      </Avatar>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Friday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Friday)}
                      >
                        Fr
                      </Avatar>
                      <Avatar
                        className={dayButtonClass(muster, DaysOfTheWeek.Saturday)}
                        onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Saturday)}
                      >
                        Sa
                      </Avatar>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MuiPickersUtilsProvider utils={MomentUtils}>
                      <TimePicker
                        id={`muster-start-time-${muster.rowKey}`}
                        disabled={formDisabled}
                        value={muster.startTimeDate}
                        InputProps={{ disableUnderline: true }}
                        onChange={setMusterStartTime(muster.rowKey)}
                      />
                    </MuiPickersUtilsProvider>
                  </TableCell>
                  <TableCell className={classes.timeZoneCell}>
                    <Autocomplete
                      id={`muster-timezone-${muster.rowKey}`}
                      value={muster.timezone}
                      disabled={formDisabled}
                      disableClearable
                      options={moment.tz.names()}
                      noOptionsText="No matching time zones"
                      renderInput={params => (
                        <TextField {...params} InputProps={{ ...params.InputProps, disableUnderline: true }} />
                      )}
                      onChange={setMusterTimezone(muster.rowKey)}
                    />
                  </TableCell>
                  <TableCell className={classes.durationCell}>
                    <TextField
                      disabled={formDisabled}
                      onChange={setMusterDuration(muster.rowKey)}
                      value={muster.durationHours}
                      type="number"
                      inputProps={{ min: '0.5', step: '0.5' }}
                    />
                  </TableCell>
                  <TableCell className={classes.iconCell}>
                    <IconButton
                      aria-label="remove muster window"
                      onClick={() => removeMusterWindow(muster.rowKey)}
                    >
                      <HighlightOffIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {errorMessage && (
          <Grid item xs={12} className={classes.errorMessage}>
            {errorMessage}
          </Grid>
        )}
        <Button
          className={classes.addMusterButton}
          color="primary"
          variant="text"
          size="small"
          startIcon={<AddCircleIcon />}
          onClick={addMusterWindow}
        >
          {hasDefaultMuster ? 'Add Another Requirement' : 'Add Muster Requirements'}
        </Button>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button disabled={formDisabled} variant="outlined" onClick={onCancel} color="primary">
          Cancel
        </Button>
        <Button disabled={!canSave()} onClick={onSave} color="primary">
          Save &amp; Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
  /* eslint-enable no-bitwise */
};
