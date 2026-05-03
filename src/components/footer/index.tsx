import Link from "@cloudscape-design/components/link";
import { useTranslation } from "../../hooks/useTranslation";
import "./styles.css";

export default function Footer() {
	const { t } = useTranslation();

	return (
		<footer id="site-footer" className="cdn-footer" role="contentinfo">
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
					<strong className="cdn-footer-emphasis">{t("footer.goBuild")}</strong>
					.
				</p>
				<span className="cdn-version">0.0.0071</span>
			</div>
		</footer>
	);
}
