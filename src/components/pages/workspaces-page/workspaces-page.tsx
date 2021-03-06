import {
  Button,
  Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Menu, MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import CheckIcon from '@material-ui/icons/Check';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import PageHeader from '../../page-header/page-header';
import useStyles from './workspaces-page.styles';
import { ApiWorkspace, ApiWorkspaceTemplate } from '../../../models/api-response';
import { EditWorkspaceDialog, EditWorkspaceDialogProps } from './edit-workspace-dialog';
import { ButtonSet } from '../../buttons/button-set';
import { Modal } from '../../../actions/modal.actions';
import { formatMessage } from '../../../utility/errors';
import { UserSelector } from '../../../selectors/user.selector';
import { WorkspacesPagesHelp } from './workspaces-pages-help';

interface WorkspaceMenuState {
  anchor: HTMLElement | null,
  workspace?: ApiWorkspace,
}

export const WorkspacesPage = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [workspaceTemplates, setWorkspaceTemplates] = useState<ApiWorkspaceTemplate[]>([]);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<null | ApiWorkspace>(null);
  const [editWorkspaceDialogProps, setEditWorkspaceDialogProps] = useState<EditWorkspaceDialogProps>({ open: false });
  const [workspaceMenu, setWorkspaceMenu] = React.useState<WorkspaceMenuState>({ anchor: null });

  const orgId = useSelector(UserSelector.orgId);

  const initializeTable = React.useCallback(async () => {
    const ws = (await axios.get(`api/workspace/${orgId}`)).data as ApiWorkspace[];
    const templates = (await axios.get(`api/workspace/${orgId}/templates`)).data as ApiWorkspaceTemplate[];
    setWorkspaces(ws);
    setWorkspaceTemplates(templates);
  }, [orgId]);

  const newWorkspace = async () => {
    setEditWorkspaceDialogProps({
      open: true,
      orgId,
      onClose: async () => {
        setEditWorkspaceDialogProps({ open: false });
        await initializeTable();
      },
      onError: (message: string) => {
        dispatch(Modal.alert('Add Workspace', `Unable to add workspace: ${message}`));
      },
    });
  };

  const editWorkspace = () => {
    if (workspaceMenu.workspace) {
      const workspace = workspaceMenu.workspace;
      setWorkspaceMenu({ anchor: null });
      setEditWorkspaceDialogProps({
        open: true,
        workspace,
        orgId,
        onClose: async () => {
          setEditWorkspaceDialogProps({ open: false });
          await initializeTable();
        },
        onError: (message: string) => {
          dispatch(Modal.alert('Edit Workspace', `Unable to edit workspace: ${message}`));
        },
      });
    }
  };

  const deleteWorkspace = () => {
    if (workspaceMenu.workspace) {
      const workspace = workspaceMenu.workspace;
      setWorkspaceMenu({ anchor: null });
      setWorkspaceToDelete(workspace);
    }
  };

  const confirmDeleteWorkspace = async () => {
    if (!workspaceToDelete) {
      return;
    }
    try {
      await axios.delete(`api/workspace/${orgId}/${workspaceToDelete.id}`);
    } catch (error) {
      dispatch(Modal.alert('Delete Workspace', formatMessage(error, 'Unable to delete workspace')));
    }
    setWorkspaceToDelete(null);
    await initializeTable();
  };

  const cancelDeleteWorkspaceDialog = () => {
    setWorkspaceToDelete(null);
  };

  const handleWorkspaceMenuClick = (workspace: ApiWorkspace) => (event: React.MouseEvent<HTMLButtonElement>) => {
    setWorkspaceMenu({ anchor: event.currentTarget, workspace });
  };

  const handleWorkspaceMenuClose = () => {
    setWorkspaceMenu({ anchor: null });
  };

  useEffect(() => { initializeTable().then(); }, [initializeTable]);

  return (
    <main className={classes.root}>
      <Container maxWidth="md">
        <PageHeader
          title="Workspaces"
          help={{
            contentComponent: WorkspacesPagesHelp,
            cardId: 'workspacesPage',
          }}
        />
        <ButtonSet>
          <Button
            size="large"
            variant="text"
            color="primary"
            onClick={newWorkspace}
            startIcon={<AddCircleIcon />}
          >
            Add New Workspace
          </Button>
        </ButtonSet>
        <TableContainer className={classes.table} component={Paper}>
          <Table aria-label="workspaces table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell className={classes.iconCell}>PII</TableCell>
                <TableCell className={classes.iconCell}>PHI</TableCell>
                <TableCell className={classes.iconCell} />
              </TableRow>
            </TableHead>
            <TableBody>
              {workspaces.map(workspace => (
                <TableRow key={workspace.id}>
                  <TableCell component="th" scope="row">{workspace.name}</TableCell>
                  <TableCell>{workspace.description}</TableCell>
                  <TableCell className={classes.iconCell}>
                    {workspace.pii && (
                      <CheckIcon />
                    )}
                  </TableCell>
                  <TableCell className={classes.iconCell}>
                    {workspace.phi && (
                      <CheckIcon />
                    )}
                  </TableCell>
                  <TableCell className={classes.iconCell}>
                    <IconButton
                      aria-label="workspace actions"
                      aria-controls={`workspace-${workspace.id}-menu`}
                      aria-haspopup="true"
                      onClick={handleWorkspaceMenuClick(workspace)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <Menu
                id="workspace-menu"
                anchorEl={workspaceMenu.anchor}
                keepMounted
                open={Boolean(workspaceMenu.workspace)}
                onClose={handleWorkspaceMenuClose}
              >
                <MenuItem onClick={editWorkspace}>Edit Workspace</MenuItem>
                <MenuItem onClick={deleteWorkspace}>Delete Workspace</MenuItem>
              </Menu>
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
      {Boolean(workspaceToDelete) && (
        <Dialog
          open={Boolean(workspaceToDelete)}
          onClose={cancelDeleteWorkspaceDialog}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">Delete Workspace</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {`Are you sure you want to delete the '${workspaceToDelete?.name}' workspace?`}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={confirmDeleteWorkspace}>
              Yes
            </Button>
            <Button onClick={cancelDeleteWorkspaceDialog}>
              No
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {editWorkspaceDialogProps.open && (
        <EditWorkspaceDialog
          open={editWorkspaceDialogProps.open}
          orgId={editWorkspaceDialogProps.orgId}
          workspace={editWorkspaceDialogProps.workspace}
          templates={workspaceTemplates}
          onClose={editWorkspaceDialogProps.onClose}
          onError={editWorkspaceDialogProps.onError}
        />
      )}
    </main>
  );
};
