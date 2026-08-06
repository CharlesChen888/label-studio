import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Typography, useToast } from "@humansignal/ui";
import { useUpdatePageTitle, createTitleFromSegments } from "@humansignal/core";
import { Spinner } from "../../components/Spinner/Spinner";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";
import { cn } from "../../utils/bem";

export const ProjectMembersSettings = () => {
  const api = useAPI();
  const toast = useToast();
  const { project } = useProject();
  const [members, setMembers] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState(null);

  useUpdatePageTitle(createTitleFromSegments([project?.title, "Members"]));

  const loadData = useCallback(async () => {
    if (!project?.id || !project?.organization) return;

    setIsLoading(true);

    try {
      const [projectMemberships, orgMemberships] = await Promise.all([
        api.callApi("projectMemberships", { params: { pk: project.id } }),
        api.callApi("memberships", {
          params: {
            pk: project.organization,
            page_size: -1,
          },
        }),
      ]);

      setMembers(projectMemberships?.results ?? projectMemberships ?? []);
      setOrganizationMembers(orgMemberships?.results ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [api, project?.id, project?.organization]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableUsers = useMemo(() => {
    const assignedUserIds = new Set(members.map((member) => member.user.id));

    return organizationMembers
      .map((membership) => membership.user)
      .filter((user) => user.id !== project?.created_by?.id && !assignedUserIds.has(user.id));
  }, [members, organizationMembers, project?.created_by?.id]);

  const handleAddMember = useCallback(async () => {
    if (!selectedUserId) return;

    setPendingUserId(selectedUserId);
    try {
      await api.callApi("createProjectMembership", {
        params: { pk: project.id },
        body: { user: selectedUserId },
      });
      setSelectedUserId("");
      toast.show({ message: "Project member added" });
      await loadData();
    } finally {
      setPendingUserId(null);
    }
  }, [api, loadData, project.id, selectedUserId, toast]);

  const handleRemoveMember = useCallback(
    async (userId) => {
      setPendingUserId(userId);
      try {
        await api.callApi("projectMembership", {
          params: { pk: project.id, userPk: userId },
        });
        toast.show({ message: "Project member removed" });
        await loadData();
      } finally {
        setPendingUserId(null);
      }
    },
    [api, loadData, project.id, toast],
  );

  return (
    <div className={cn("simple-settings").toClassName()}>
      <Typography variant="headline" size="medium" className="mb-tighter">
        Project Members
      </Typography>
      <Typography variant="body" size="medium" className="text-neutral-content-subtler !mb-base">
        Superusers can grant project access to specific organization members here.
      </Typography>

      <div className={cn("settings-wrapper").toClassName()}>
        <Typography variant="title" size="large" className="mb-tight">
          Project creator
        </Typography>
        <Typography className="mb-base">
          {project?.created_by?.email ?? "Unknown user"}
        </Typography>

        <Typography variant="title" size="large" className="mb-tight">
          Add member
        </Typography>
        {isLoading ? (
          <div className="py-4">
            <Spinner />
          </div>
        ) : (
          <div className="flex gap-3 items-end mb-wide">
            <label className="flex-1">
              <span className="block text-sm text-neutral-content-subtler mb-1">Organization member</span>
              <select
                className="lsf-input-ls w-full"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="">Select a user</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={() => void handleAddMember()}
              disabled={!selectedUserId || pendingUserId !== null}
              aria-label="Add project member"
            >
              Add Member
            </Button>
          </div>
        )}

        <Typography variant="title" size="large" className="mb-tight">
          Current members
        </Typography>
        {isLoading ? (
          <div className="py-4">
            <Spinner />
          </div>
        ) : members.length === 0 ? (
          <Typography size="small" className="text-neutral-content-subtler">
            No additional members have been assigned to this project yet.
          </Typography>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center justify-between rounded border border-neutral-border-subtle px-4 py-3"
              >
                <div>
                  <Typography>{member.user.email}</Typography>
                  <Typography size="small" className="text-neutral-content-subtler">
                    {member.user.first_name || member.user.last_name
                      ? `${member.user.first_name ?? ""} ${member.user.last_name ?? ""}`.trim()
                      : "Regular user"}
                  </Typography>
                </div>
                <Button
                  look="outlined"
                  variant="negative"
                  onClick={() => void handleRemoveMember(member.user.id)}
                  disabled={pendingUserId !== null}
                  aria-label={`Remove ${member.user.email} from project`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

ProjectMembersSettings.menuItem = "Members";
ProjectMembersSettings.path = "/members";
