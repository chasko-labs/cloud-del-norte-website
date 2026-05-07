import { useEffect, useState } from "react";
import { probeOembed } from "../lib/youtube-oembed-cache";

type ChannelLive = { live: boolean; videoId: string | null };

export function useChannelLive(channelUrl: string): ChannelLive {
	const [value, setValue] = useState<ChannelLive>({
		live: false,
		videoId: null,
	});
	useEffect(() => {
		let cancelled = false;
		probeOembed(channelUrl).then((result) => {
			if (cancelled || !result) return;
			setValue({ live: result.live, videoId: result.videoId });
		});
		return () => {
			cancelled = true;
		};
	}, [channelUrl]);
	return value;
}
