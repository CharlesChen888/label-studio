import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button, Select, Badge } from "@humansignal/ui";
import { cn } from "../../../utils/bem";
import "./SelectedUser.prefix.css";

const ROLE_CHOICES = [
  { value: "owner", label: "Owner" },
  { value: "annotator", label: "Annotator" },
  { value: "reviewer", label: "Reviewer" },
];

const ROLE_VARIANTS = {
  owner: "grape",
  annotator: "sand",
  reviewer: "canteloupe",
};

const UserProjectsLinks = ({ projects }) => {
  return (
    <div className={cn("user-info").elem("links-list").toClassName()}>
      {projects.map((project) => (
        <NavLink
          className={cn("user-info").elem("project-link").toClassName()}
          key={`project-${project.id}`}
          to={`/projects/${project.id}`}
          data-external
        >
          {project.title}
        </NavLink>
      ))}
    </div>
  );
};

export const SelectedUser = ({ member, onClose, onUpdateRole, canModifyRole }) => {
  const user = member?.user;
  const [role, setRole] = useState(member?.role || "annotator");
  const [saving, setSaving] = useState(false);

  // 当切换用户时，同步更新 role 状态
  useEffect(() => {
    setRole(member?.role || "annotator");
  }, [member?.user?.id]);

  const fullName = [user?.first_name, user?.last_name]
    .filter((n) => !!n)
    .join(" ")
    .trim();

  const handleRoleChange = useCallback(
    async (newRole) => {
      if (role === newRole || saving) return;

      setSaving(true);
      try {
        await onUpdateRole(member, newRole);
        setRole(newRole);
      } catch (error) {
        // Error is already handled in the parent component
      } finally {
        setSaving(false);
      }
    },
    [role, saving, onUpdateRole, member]
  );

  return (
    <div className={cn("user-info").toClassName()}>
      <Button
        look="string"
        onClick={onClose}
        className="absolute top-[20px] right-[24px]"
        aria-label="Close user details"
      >
        <IconCross />
      </Button>

      <div className={cn("user-info").elem("header").toClassName()}>
        <Userpic user={user} style={{ width: 64, height: 64, fontSize: 28 }} />
        <div className={cn("user-info").elem("info-wrapper").toClassName()}>
          {fullName && <div className={cn("user-info").elem("full-name").toClassName()}>{fullName}</div>}
          <p className={cn("user-info").elem("email").toClassName()}>{user?.email}</p>
          <div className={cn("user-info").elem("role-badge").toClassName()}>
            <Badge variant={ROLE_VARIANTS[role] || "sand"}>{ROLE_CHOICES.find(r => r.value === role)?.label || role}</Badge>

            {canModifyRole && (
              <Select
                options={ROLE_CHOICES}
                value={role}
                onChange={handleRoleChange}
                disabled={saving}
                className={cn("user-info").elem("role-select").toClassName()}
              />
            )}
          </div>
        </div>
      </div>

      {user?.phone && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <a href={`tel:${user.phone}`}>{user.phone}</a>
        </div>
      )}

      {!!user?.created_projects?.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>Created Projects</div>

          <UserProjectsLinks projects={user.created_projects} />
        </div>
      )}

      {!!user?.contributed_to_projects?.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>Contributed to</div>

          <UserProjectsLinks projects={user.contributed_to_projects} />
        </div>
      )}

      <p className={cn("user-info").elem("last-active").toClassName()}>
        Last activity on: {format(new Date(user.last_activity), "dd MMM yyyy, KK:mm a")}
      </p>
    </div>
  );
};
