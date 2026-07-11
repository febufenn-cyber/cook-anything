import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("budget-recipes");

export default function Page() {
  return <CollectionView slug="budget-recipes" />;
}
