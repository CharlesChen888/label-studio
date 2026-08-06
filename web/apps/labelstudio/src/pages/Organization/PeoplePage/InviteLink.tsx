import { Button, Typography } from "@humansignal/ui";
import { Space } from "@humansignal/ui/lib/space/space";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "apps/labelstudio/src/utils/bem";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "../../../components/Form";
import { Modal } from "../../../components/Modal/ModalPopup";
import { useAPI } from "../../../providers/ApiProvider";

const inviteLinkQueryKey = ["invite-link"];

export function InviteLink({
  opened,
  onOpened,
  onClosed,
}: {
  opened: boolean;
  onOpened?: () => void;
  onClosed?: () => void;
}) {
  const modalRef = useRef<Modal>();
  const api = useAPI();
  const queryClient = useQueryClient();

  const { data: link, isFetching } = useQuery({
    queryKey: inviteLinkQueryKey,
    enabled: opened,
    async queryFn() {
      const result = await api.callApi<{ invite_url: string }>("inviteLink");

      return location.origin + result.invite_url;
    },
  });

  useEffect(() => {
    if (modalRef.current && opened) {
      modalRef.current?.show?.();
    } else if (modalRef.current && modalRef.current.visible) {
      modalRef.current?.hide?.();
    }
  }, [opened]);

  const handleReset = useCallback(async () => {
    const result = await api.callApi<{ invite_url: string }>("resetInviteLink");

    queryClient.setQueryData(inviteLinkQueryKey, location.origin + result.invite_url);
  }, [api, queryClient]);

  return (
    <Modal
      ref={modalRef}
      title="Invite members"
      opened={opened}
      bareFooter={true}
      body={<InvitationModal link={link} isFetching={isFetching} />}
      footer={<InvitationFooter link={link} isFetching={isFetching} onReset={handleReset} />}
      style={{ width: 640, height: 472 }}
      onHide={onClosed}
      onShow={onOpened}
    />
  );
}

const InvitationModal = ({ link, isFetching }: { link?: string; isFetching: boolean }) => {
  return (
    <div className={cn("invite").toClassName()}>
      <Input value={isFetching ? "Loading..." : (link ?? "")} style={{ width: "100%" }} readOnly />
      <Typography size="small" className="text-neutral-content-subtler mt-base mb-wider">
        Invite members to join your Label Studio instance. Invited users start as regular users and can access only the
        projects that a superuser assigns to them.{" "}
        <a
          href="https://labelstud.io/guide/signup.html"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
          onClick={() =>
            __lsa("docs.organization.add_people.learn_more", {
              href: "https://labelstud.io/guide/signup.html",
            })
          }
        >
          Learn more
        </a>
        .
      </Typography>
    </div>
  );
};

const InvitationFooter = ({
  link,
  isFetching,
  onReset,
}: {
  link?: string;
  isFetching: boolean;
  onReset: () => Promise<void>;
}) => {
  const { copyText, copied } = useTextCopy();

  return (
    <Space spread>
      <Space>
        <Button
          variant="negative"
          look="outlined"
          style={{ width: 170 }}
          onClick={() => void onReset()}
          aria-label="Refresh invite link"
          disabled={isFetching}
        >
          Reset Link
        </Button>
      </Space>
      <Space>
        <Button
          variant={copied ? "positive" : "primary"}
          className="w-[170px]"
          onClick={() => copyText(link ?? "")}
          aria-label="Copy invite link"
          disabled={!link}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </Space>
    </Space>
  );
};

function useTextCopy() {
  const [copied, setCopied] = useState(false);

  const copyText = useCallback((value: string) => {
    setCopied(true);
    navigator.clipboard.writeText(value ?? "");
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return { copied, copyText };
}
