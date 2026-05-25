import { useEffect, useState } from "react";
import { probeOembed } from "../lib/youtube-oembed-cache";

type ChannelLive = { live: boolean; videoId: string | null };

const INITIAL: ChannelLive = { live: false, videoId: null };

export function useChannelLive(
	channelUrl: string,
	enabled = true,
): ChannelLive {
	const [value, setValue] = useState<ChannelLive>(INITIAL);
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		probeOembed(channelUrl).then((result) => {
			if (cancelled || !result) return;
			setValue({ live: result.live, videoId: result.videoId });
		});
		return () => {
			cancelled = true;
		};
	}, [channelUrl, enabled]);
	return value;
}
