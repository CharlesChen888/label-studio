import { format, subDays, parseISO } from "date-fns";
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

// 角色选项，用于修改别人的角色（不包含 owner）
const EDITABLE_ROLE_CHOICES = [
  { value: "annotator", label: "Annotator" },
  { value: "reviewer", label: "Reviewer" },
];

const ROLE_VARIANTS = {
  owner: "grape",
  annotator: "sand",
  reviewer: "canteloupe",
};

// 贡献热图组件 - 使用D3绘制类似GitHub的贡献热图
const ContributionHeatmap = ({ annotationsByDate, user }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  
  // 获取数据范围 - GitHub风格：显示最近一年的贡献，每天一个格子
  // 为了简化，我们只显示最近30天
  const today = new Date();
  const last30Days = Array.from({ length: 30 }, (_, i) => subDays(today, i)).reverse();
  
  // 计算最大标注数量
  const maxCount = Math.max(
    1,
    ...last30Days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return annotationsByDate[dayStr] || 0;
    })
  );
  
  // 颜色渐变 - 从浅色到深色
  const getColor = (count) => {
    if (count === 0) return '#ebedf0';
    const intensity = count / maxCount;
    if (intensity < 0.25) return '#9be9a8';
    if (intensity < 0.5) return '#40c463';
    if (intensity < 0.75) return '#30a14e';
    return '#216e39';
  };
  
  return (
    <div className={cn("user-info").elem("heatmap").toClassName()}>
      <div className={cn("user-info").elem("heatmap-title").toClassName()}>
        Recent Contributions (Last 30 Days)
      </div>
      <div className={cn("user-info").elem("heatmap-grid").toClassName()}>
        {last30Days.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const count = annotationsByDate[dateStr] || 0;
          
          return (
            <div
              key={dateStr}
              className={cn("user-info").elem("heatmap-cell").toClassName()}
              style={{ backgroundColor: getColor(count) }}
              onMouseEnter={() => setHoveredCell({ date, count })}
              onMouseLeave={() => setHoveredCell(null)}
              title={`${format(date, 'MMM dd, yyyy')}: ${count} annotations`}
            />
          );
        })}
      </div>
      {hoveredCell && (
        <div className={cn("user-info").elem("heatmap-tooltip").toClassName()}>
          {format(hoveredCell.date, 'MMM dd, yyyy')}: {hoveredCell.count} annotations
        </div>
      )}
    </div>
  );
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

export const SelectedUser = ({ member, onClose, onUpdateRole, canModifyRole, currentUser }) => {
  const user = member?.user;
  const [role, setRole] = useState(member?.role || "annotator");
  const [saving, setSaving] = useState(false);
  const [annotationsData, setAnnotationsData] = useState({ total: 0, accepted: 0, rejected: 0, byDate: {} });

  // 当切换用户时，同步更新 role 状态
  useEffect(() => {
    setRole(member?.role || "annotator");
  }, [member?.user?.id]);

  // 获取贡献数据
  useEffect(() => {
    if (user?.id && member?.organization) {
      // 获取用户最近30天的标注数据
      const fetchAnnotations = async () => {
        try {
          console.log('Fetching contributions for user:', user.id, 'in org:', member.organization);
          const response = await fetch(`/api/organizations/${member.organization}/memberships/${user.id}/contributions?contributed_to_projects=1`);
          console.log('API response status:', response.status);
          const data = await response.json();
          
          console.log('Contributions API response:', data);
          
          if (data.annotations_by_date && typeof data.annotations_count === 'number') {
            setAnnotationsData({
              total: data.annotations_count,
              accepted: data.accepted_annotations_count || 0,
              rejected: data.rejected_annotations_count || 0,
              byDate: data.annotations_by_date
            });
          } else {
            console.warn('Invalid API response format:', data);
          }
        } catch (error) {
          console.error('Failed to fetch annotations:', error);
        }
      };
      
      fetchAnnotations();
    }
  }, [user?.id, member?.organization]);

  // Only show role selector if user can modify roles AND is not viewing their own profile
  const isCurrentUser = currentUser?.id === user?.id;
  const showRoleSelector = canModifyRole && !isCurrentUser;

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

            {showRoleSelector && (
              <Select
                options={EDITABLE_ROLE_CHOICES}
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

      {/* 贡献统计卡片 */}
      <div className={cn("user-info").elem("section").toClassName()}>
        <div className={cn("user-info").elem("section-title").toClassName()}>Contribution Statistics</div>
        
        {/* 统计卡片 */}
        <div className={cn("user-info").elem("stats-cards").toClassName()}>
          <div className={cn("user-info").elem("stat-card").toClassName()}>
            <div className={cn("user-info").elem("stat-value").toClassName()}>
              {annotationsData.total || user?.annotations_count || 0}
            </div>
            <div className={cn("user-info").elem("stat-label").toClassName()}>Total Annotations</div>
          </div>
          
          <div className={cn("user-info").elem("stat-card").toClassName()}>
            <div className={cn("user-info").elem("stat-value").toClassName()}>
              {annotationsData.accepted || user?.accepted_annotations_count || 0}
            </div>
            <div className={cn("user-info").elem("stat-label").toClassName()}>Total Accepted Annotations</div>
          </div>
          
          <div className={cn("user-info").elem("stat-card").toClassName()}>
            <div className={cn("user-info").elem("stat-value").toClassName()}>
              {user?.contributed_projects_count || user?.contributed_to_projects?.length || 0}
            </div>
            <div className={cn("user-info").elem("stat-label").toClassName()}>Projects</div>
          </div>
        </div>
        
        {/* 贡献热图 */}
        <ContributionHeatmap annotationsByDate={annotationsData.byDate} user={user} />
      </div>

      <p className={cn("user-info").elem("last-active").toClassName()}>
        Last activity on: {format(new Date(user.last_activity), "dd MMM yyyy, KK:mm a")}
      </p>
    </div>
  );
};
