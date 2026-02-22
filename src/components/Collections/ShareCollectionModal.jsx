import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Button,
  Message,
  useToaster,
  RadioGroup,
  Radio,
  Input,
  List,
  Loader,
} from 'rsuite';
import authFetch from '../../helpers/authFetch';

const SPACING = {
  bodyPadding: 24,
  inputGap: 8,
};

const FONT = {
  emptyMessage: 12,
};

const COLORS = {
  muted: '#aaa',
};

const TOAST_DURATION = 3000;

const ShareCollectionModal = ({ open, onClose, collection }) => {
  const [visibility, setVisibility] = useState(collection?.visibility || 'PRIVATE');
  const [inviteEmail, setInviteEmail] = useState('');
  const [shares, setShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [updating, setUpdating] = useState(false);
  const toaster = useToaster();

  useEffect(() => {
    if (open && collection) {
      setInviteEmail('');
      setInviteError('');
      setInviteSuccess('');
      setVisibility(collection.visibility);
      fetchShares();
    }
  }, [open, collection]);

  const fetchShares = async () => {
    setSharesLoading(true);
    try {
      const resp = await authFetch(`/collections/${collection.id}/shares`);
      const data = await resp.json();
      if (resp.ok) {
        setShares(data);
      } else {
        setShares([]);
      }
    } catch (err) {
      console.error('Failed to fetch shares:', err);
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  };

  const handleVisibilityChange = async (newVisibility) => {
    setUpdating(true);
    try {
      const resp = await authFetch(`/collections/${collection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (resp.ok) {
        setVisibility(newVisibility);
        toaster.push(
          <Message showIcon closable type="success">Visibility set to {newVisibility === 'PUBLIC' ? 'Public' : newVisibility === 'INVITE_ONLY' ? 'Invite Only' : 'Private'}</Message>,
          { placement: 'topCenter', duration: TOAST_DURATION }
        );
      } else {
        const data = await resp.json();
        toaster.push(
          <Message showIcon closable type="error">{data.error || 'Failed to update visibility'}</Message>,
          { placement: 'topCenter', duration: TOAST_DURATION }
        );
      }
    } catch (err) {
      console.error('Error updating visibility:', err);
      toaster.push(
        <Message showIcon closable type="error">Error updating visibility</Message>,
        { placement: 'topCenter', duration: TOAST_DURATION }
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleInvite = async () => {
    setInviteError('');
    setInviteSuccess('');

    if (!inviteEmail) {
      setInviteError('Email is required');
      return;
    }

    try {
      const resp = await authFetch(`/collections/${collection.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await resp.json();

      if (resp.ok) {
        setInviteSuccess(`Invited ${inviteEmail}`);
        setInviteEmail('');
        fetchShares();
      } else {
        setInviteError(data.error || 'Failed to invite user');
      }
    } catch (err) {
      console.error('Error inviting user:', err);
      setInviteError('Error inviting user');
    }
  };

  const handleRemoveShare = async (shareId) => {
    try {
      const resp = await authFetch(`/collections/${collection.id}/shares/${shareId}`, {
        method: 'DELETE',
      });

      if (resp.ok) {
        fetchShares();
        toaster.push(
          <Message showIcon closable type="success">Share removed</Message>,
          { placement: 'topCenter', duration: TOAST_DURATION }
        );
      } else {
        toaster.push(
          <Message showIcon closable type="error">Failed to remove share</Message>,
          { placement: 'topCenter', duration: TOAST_DURATION }
        );
      }
    } catch (err) {
      console.error('Error removing share:', err);
      toaster.push(
        <Message showIcon closable type="error">Error removing share</Message>,
        { placement: 'topCenter', duration: TOAST_DURATION }
      );
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/shared/${collection.share_slug}`;
    navigator.clipboard.writeText(link);
    toaster.push(
      <Message showIcon closable type="success">Link copied to clipboard</Message>,
      { placement: 'topCenter', duration: TOAST_DURATION }
    );
  };

  if (!collection) return null;

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>Share {collection.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ paddingBottom: SPACING.bodyPadding }}>
        <Form>
          <Form.Group>
            <Form.ControlLabel>Visibility</Form.ControlLabel>
            <RadioGroup
              value={visibility}
              onChange={(val) => handleVisibilityChange(val)}
              disabled={updating}
            >
              <Radio value="PRIVATE">Private (Only you)</Radio>
              <Radio value="INVITE_ONLY">Invite Only (Share with friends)</Radio>
              <Radio value="PUBLIC">Public (Anyone with link)</Radio>
            </RadioGroup>
          </Form.Group>

          {(visibility === 'PUBLIC' || visibility === 'INVITE_ONLY') && collection.share_slug && (
            <Form.Group>
              <Form.ControlLabel>Shareable Link</Form.ControlLabel>
              <div style={{ display: 'flex', gap: SPACING.inputGap }}>
                <Input
                  readOnly
                  value={`${window.location.origin}/shared/${collection.share_slug}`}
                  size="xs"
                />
                <Button size="xs" onClick={copyLink}>
                  Copy
                </Button>
              </div>
            </Form.Group>
          )}

          {(visibility === 'INVITE_ONLY' || visibility === 'PUBLIC') && (
            <>
              <Form.Group>
                <Form.ControlLabel>Invite by Email</Form.ControlLabel>
                <div style={{ display: 'flex', gap: SPACING.inputGap }}>
                  <Input
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(val) => setInviteEmail(val)}
                    size="xs"
                    disabled={sharesLoading}
                  />
                  <Button size="xs" onClick={handleInvite} disabled={sharesLoading || !inviteEmail}>
                    Invite
                  </Button>
                </div>
                {inviteError && <Message type="error" showIcon>{inviteError}</Message>}
                {inviteSuccess && <Message type="success" showIcon>{inviteSuccess}</Message>}
              </Form.Group>

              <Form.Group>
                <Form.ControlLabel>Invited Users</Form.ControlLabel>
                {sharesLoading ? (
                  <Loader size="sm" />
                ) : shares.length === 0 ? (
                  <div style={{ color: COLORS.muted, fontSize: FONT.emptyMessage }}>No users invited yet</div>
                ) : (
                  <List bordered>
                    {shares.map((share) => (
                      <List.Item key={share.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{share.email}</span>
                        <Button
                          size="xs"
                          appearance="ghost"
                          color="red"
                          onClick={() => handleRemoveShare(share.id)}
                        >
                          Remove
                        </Button>
                      </List.Item>
                    ))}
                  </List>
                )}
              </Form.Group>
            </>
          )}

          {visibility === 'PRIVATE' && (
            <Message type="info" showIcon>
              This collection is private. Only you can view it.
            </Message>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose} appearance="default">
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShareCollectionModal;
