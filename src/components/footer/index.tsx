import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import leaders from "../../data/leaders.json";
import { useTranslation } from "../../hooks/useTranslation";
import type { Leader } from "./leader-card";
import LeaderCard from "./leader-card";
import "./styles.css";

export default function Footer() {
	const { t } = useTranslation();

	return (
		<footer id="site-footer" className="cdn-footer" role="contentinfo">
			<SpaceBetween size="l">
				<div>
					<h2 className="cdn-footer-heading">{t("footer.ourLeaders")}</h2>
					<div className="cdn-footer-grid">
						{(leaders as Leader[]).map((leader) => (
							<LeaderCard key={leader.id} leader={leader} />
						))}
					</div>
				</div>

				<div className="cdn-footer-bottom">
					<p className="cdn-footer-community">
						{t("footer.communityDescription")}{" "}
						<Link
							href="https://www.meetup.com/pro/global-aws-user-group-community/"
							external
							variant="primary"
						>
							{t("footer.globalCommunity")}
						</Link>
						. {t("footer.communityFullDescription")}{" "}
						<strong className="cdn-footer-emphasis">
							{t("footer.goBuild")}
						</strong>
						.
					</p>
				</div>
			</SpaceBetween>
		</footer>
	);
}
