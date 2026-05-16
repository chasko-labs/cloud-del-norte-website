// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export function SkeletonLine() {
	return <div className="cdn-skeleton cdn-skeleton--line" aria-hidden="true" />;
}

export function SkeletonTitle() {
	return (
		<div className="cdn-skeleton cdn-skeleton--title" aria-hidden="true" />
	);
}

export function SkeletonBlock() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="cdn-skeleton cdn-skeleton--block"
		>
			<span className="awsui-util-hide">Loading…</span>
		</div>
	);
}

export function SkeletonFrame() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="cdn-skeleton cdn-skeleton--frame"
		>
			<span className="awsui-util-hide">Loading…</span>
		</div>
	);
}
