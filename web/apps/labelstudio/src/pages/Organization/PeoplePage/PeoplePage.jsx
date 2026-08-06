import { Button } from "@humansignal/ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { useUpdatePageTitle } from "@humansignal/core";
import { useAuth } from "@humansignal/core/providers/AuthProvider";
import { useAPI } from "../../../providers/ApiProvider";
import { HeidiTips } from "../../../components/HeidiTips/HeidiTips";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { cn } from "../../../utils/bem";
import { FF_AUTH_TOKENS, FF_LSDV_E_297, isFF } from "../../../utils/feature-flags";
import "./PeopleInvitation.prefix.css";
import { PeopleList } from "./PeopleList";
import "./PeoplePage.prefix.css";
import { TokenSettingsModal } from "@humansignal/app-common/blocks/TokenSettingsModal";
import { IconPlus } from "@humansignal/icons";
import { useToast } from "@humansignal/ui";
import { InviteLink } from "./InviteLink";
import { SelectedUser } from "./SelectedUser";

export const PeoplePage = () => {
  const apiSettingsModal = useRef();
  const toast = useToast();
  const api = useAPI();
  const { user } = useAuth();
  const [selectedMember, setSelectedMember] = useState(null);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const canInviteMembers = Boolean(user?.is_superuser);

  // Check if current user can modify roles (superuser or owner)
  // Owner check will be done on the backend; we show the UI for superusers by default
  // and will attempt for others (backend will enforce permissions)
  const canModifyRoles = user?.is_superuser;

  useUpdatePageTitle("People");

  const selectMember = useCallback(
    (member) => {
      setSelectedMember(member);

      localStorage.setItem("selectedUser", member?.user?.id);
    },
    [setSelectedMember],
  );

  const apiTokensSettingsModalProps = useMemo(
    () => ({
      title: "API Token Settings",
      style: { width: 480 },
      body: () => (
        <TokenSettingsModal
          onSaved={() => {
            toast.show({ message: "API Token settings saved" });
            apiSettingsModal.current?.close();
          }}
        />
      ),
    }),
    [],
  );

  const handleRoleUpdate = useCallback(
    async (member, newRole) => {
      try {
        const response = await api.callApi("updateMemberRole", {
          params: {
            pk: member.organization,
            userPk: member.user.id,
          },
          body: { role: newRole },
        });

        selectMember(response.response);
        setListRefreshKey((k) => k + 1);

        toast.show({ message: "User role updated successfully" });

        return response.response;
      } catch (error) {
        toast.show({ message: `Failed to update role: ${error.message || "Unknown error"}`, type: "error" });
        throw error;
      }
    },
    [api, selectMember, toast]
  );

  const showApiTokenSettingsModal = useCallback(() => {
    apiSettingsModal.current = modal(apiTokensSettingsModalProps);
    __lsa("organization.token_settings");
  }, [apiTokensSettingsModalProps]);

  const defaultSelected = useMemo(() => {
    return localStorage.getItem("selectedUser");
  }, []);

  return (
    <div className={cn("people").toClassName()}>
      <div className={cn("people").elem("controls").toClassName()}>
        <Space spread>
          <Space />

          <Space>
            {isFF(FF_AUTH_TOKENS) && (
              <Button look="outlined" onClick={showApiTokenSettingsModal} aria-label="Show API token settings">
                API Tokens Settings
              </Button>
            )}
            {canInviteMembers && (
              <Button
                leading={<IconPlus className="!h-4" />}
                onClick={() => setInvitationOpen(true)}
                aria-label="Invite new member"
              >
                Add Members
              </Button>
            )}
          </Space>
        </Space>
      </div>
      <div className={cn("people").elem("content").toClassName()}>
        <PeopleList
          selectedMember={selectedMember}
          defaultSelected={defaultSelected}
          onSelect={(member) => selectMember(member)}
          refreshKey={listRefreshKey}
        />

        {selectedMember ? (
          <SelectedUser
            member={selectedMember}
            onClose={() => selectMember(null)}
            onUpdateRole={handleRoleUpdate}
            canModifyRole={canModifyRoles}
          />
        ) : (
          isFF(FF_LSDV_E_297) && <HeidiTips collection="organizationPage" />
        )}
      </div>
      {canInviteMembers && (
        <InviteLink
          opened={invitationOpen}
          onClosed={() => {
            setInvitationOpen(false);
          }}
        />
      )}
    </div>
  );
};

PeoplePage.title = "People";
PeoplePage.path = "/";
